<template>
  <a-card size="small" class="h-full">
    <div class="flex flex-wrap gap-x-10 gap-y-2">
      <!-- The Light / Chaos swatches double as the legend -->
      <div v-for="stat in stats" :key="stat.label">
        <div class="flex items-center gap-1.5 text-sm font-medium">
          <span v-if="stat.color" class="inline-block h-2.5 w-2.5 rounded-sm" :style="{ background: stat.color }" />
          {{ stat.label }}
        </div>
        <div class="text-xl font-semibold tabular-nums">{{ stat.value }}</div>
      </div>
      <div class="flex-1" />
      <a-typography-text type="secondary" class="self-start text-xs">Trains started per hour, last 24 hours</a-typography-text>
    </div>
    <VChart :option="option" style="height: 90px" autoresize />
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import { SURFACE, tooltipStyle } from '@/views/bis-tracker/dashboard/chartTheme'
import { DC_COLORS, type DataCenterName, type Train } from './trains'

const props = defineProps<{ trains: Train[]; now: number }>()

const HOUR_MS = 3_600_000
const HOURS = 24
const DCS = Object.keys(DC_COLORS) as DataCenterName[]

const recent = computed(() => props.trains.filter((t) => t.startsAt <= props.now && t.startsAt > props.now - HOURS * HOUR_MS))

// Hour buckets ending now; the last one is the hour so far
const buckets = computed(() => {
  const from = props.now - HOURS * HOUR_MS
  const counts = Array.from({ length: HOURS }, (_, i) => ({ start: from + i * HOUR_MS, Light: 0, Chaos: 0 }))
  for (const t of recent.value) counts[Math.min(HOURS - 1, Math.floor((t.startsAt - from) / HOUR_MS))]![t.dc]++
  return counts
})

const stats = computed<{ label: string; value: number; color?: string }[]>(() => [
  { label: 'Trains', value: recent.value.length },
  ...DCS.map((dc) => ({ label: dc, value: recent.value.filter((t) => t.dc === dc).length, color: DC_COLORS[dc] })),
])

const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { timeStyle: 'short' })

const option = computed<EChartsOption>(() => {
  const max = Math.max(2, ...buckets.value.flatMap((b) => DCS.map((dc) => b[dc])))
  return {
    grid: { top: 12, right: 8, bottom: 4, left: 8 },
    tooltip: {
      ...tooltipStyle,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#434343' } },
      formatter: (params) => {
        const p = (params as { dataIndex: number }[])[0]!
        const b = buckets.value[p.dataIndex]!
        const end = Math.min(b.start + HOUR_MS, props.now)
        const rows = DCS.map((dc) => `<span style="color:${DC_COLORS[dc]}">●</span> ${dc} <b>${b[dc]}</b>`)
        return `${time(b.start)}–${time(end)}<br/>${rows.join('<br/>')}`
      },
    },
    xAxis: { type: 'category', show: false, boundaryGap: false, data: buckets.value.map((b) => b.start) },
    yAxis: { type: 'value', show: false, min: 0, max },
    series: DCS.map((dc) => ({
      type: 'line' as const,
      name: dc,
      data: buckets.value.map((b) => b[dc]),
      smooth: true,
      lineStyle: { color: DC_COLORS[dc], width: 2 },
      itemStyle: { color: DC_COLORS[dc], borderColor: SURFACE, borderWidth: 2 },
      // Only the newest point is drawn, like a "now" marker; the rest show on hover
      symbol: 'circle',
      symbolSize: (_value: unknown, params: { dataIndex: number }) => (params.dataIndex === HOURS - 1 ? 9 : 0),
      showSymbol: true,
      emphasis: { scale: false },
    })),
  }
})
</script>

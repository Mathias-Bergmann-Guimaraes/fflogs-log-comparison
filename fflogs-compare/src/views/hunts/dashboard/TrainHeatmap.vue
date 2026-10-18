<template>
  <a-card size="small" title="When trains start" class="h-full">
    <template #extra>
      <a-segmented v-model:value="filter" size="small" :options="filterOptions" />
    </template>
    <a-empty v-if="!filtered.length" :image="Empty.PRESENTED_IMAGE_SIMPLE" description="No trains of this kind yet" />
    <template v-else>
      <VChart :option="option" style="height: 260px" autoresize />
      <a-typography-text type="secondary" class="text-xs">
        Start times of {{ filtered.length }} {{ filtered.length === 1 ? 'train' : 'trains' }} in the last {{ DAYS }} days, in your time zone
      </a-typography-text>
    </template>
  </a-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Empty } from 'ant-design-vue'
import type { EChartsOption } from 'echarts'
import { SURFACE, axisStyle, textSecondary, tooltipStyle } from '@/views/bis-tracker/dashboard/chartTheme'
import { TRAIN_TYPES, type Train, type TrainTypeKey } from './trains'

const props = defineProps<{ trains: Train[]; now: number }>()

const DAYS = 90
// Monday first, as in the EU
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
// Sequential, one hue: dark blue near the card surface up to light blue for the busiest slot
const RAMP = ['#16304f', '#2a63a8', '#3987e5', '#8fc0f5']

const filter = ref<'all' | TrainTypeKey>('all')
const filterOptions = [{ label: 'All', value: 'all' }, ...TRAIN_TYPES.map((t) => ({ label: t.label, value: t.key }))]

const filtered = computed(() =>
  props.trains.filter(
    (t) => t.startsAt <= props.now && t.startsAt >= props.now - DAYS * 86_400_000 && (filter.value === 'all' || t.types.includes(filter.value)),
  ),
)

// [hour, weekday row, count]; empty slots are left out so they show as plain card
const cells = computed(() => {
  const counts = new Map<string, number>()
  for (const t of filtered.value) {
    const date = new Date(t.startsAt)
    const key = `${date.getHours()}|${(date.getDay() + 6) % 7}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].map(([key, count]) => [...key.split('|').map(Number), count] as [number, number, number])
})

const option = computed<EChartsOption>(() => ({
  grid: { top: 8, right: 8, bottom: 48, left: 8, containLabel: true },
  tooltip: {
    ...tooltipStyle,
    formatter: (p) => {
      const [hour, day, count] = (p as unknown as { value: [number, number, number] }).value
      return `${WEEKDAYS[day]} ${HOURS[hour]}:00–${HOURS[(hour + 1) % 24]}:00<br/><b>${count}</b> ${count === 1 ? 'train' : 'trains'}`
    },
  },
  xAxis: { type: 'category', data: HOURS, ...axisStyle, splitLine: { show: false }, axisLabel: { ...axisStyle.axisLabel, interval: 1 } },
  yAxis: { type: 'category', data: WEEKDAYS, inverse: true, ...axisStyle, splitLine: { show: false } },
  visualMap: {
    min: 1,
    max: Math.max(2, ...cells.value.map((c) => c[2])),
    calculable: false,
    orient: 'horizontal',
    left: 'center',
    bottom: 0,
    itemHeight: 120,
    itemWidth: 10,
    inRange: { color: RAMP },
    textStyle: { color: textSecondary },
    text: ['more', 'fewer'],
  },
  series: [
    {
      type: 'heatmap',
      data: cells.value,
      itemStyle: { borderColor: SURFACE, borderWidth: 2, borderRadius: 4 },
      emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } },
    },
  ],
}))
</script>

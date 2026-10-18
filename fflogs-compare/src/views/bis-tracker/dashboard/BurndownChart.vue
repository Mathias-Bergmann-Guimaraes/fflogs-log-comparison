<template>
  <!-- Body fills the card, and the chart fills the body: it grows when the row is taller than 280px -->
  <a-card
    size="small"
    title="Items left to buy, week by week"
    class="flex! h-full flex-col!"
    :body-style="{ flex: 1, display: 'flex', flexDirection: 'column' }"
  >
    <template #extra>
      <a-typography-text type="secondary" class="text-xs">Assumes no lucky drops</a-typography-text>
    </template>
    <a-empty v-if="!plan.doneWeek.value" :image="Empty.PRESENTED_IMAGE_SIMPLE" description="Nothing left to buy" />
    <VChart v-else :option="option" class="min-h-70 flex-1" autoresize />
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Empty } from 'ant-design-vue'
import type { EChartsOption } from 'echarts'
import { formatDate, useBisPlan, weekStart } from '@/composables/useBisPlan'
import { axisStyle, barItemStyle, legendStyle, statusColors, tooltipStyle } from './chartTheme'

const plan = useBisPlan()

// Point k = what's still open after week k's purchases; week k ends at the start of week k+1
const labels = computed(() => plan.burndown.value.map((p) => (p.week === 0 ? 'Now' : formatDate(weekStart(p.week + 1)))))

const option = computed<EChartsOption>(() => ({
  grid: { top: 36, right: 8, bottom: 24, left: 36 },
  legend: { ...legendStyle, top: 0, left: 0, data: ['Tomestone items', 'Raid items'] },
  tooltip: {
    ...tooltipStyle,
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (params: unknown) => {
      const rows = params as { axisIndex: number; dataIndex: number; seriesName: string; value: number; marker: string }[]
      const i = rows[0]!.dataIndex
      const head = i === 0 ? 'Now' : `After reset on ${labels.value[i]}`
      return [`<b>${head}</b>`, ...rows.map((r) => `${r.marker} ${r.seriesName}: ${r.value}`), `Total: ${plan.burndown.value[i]!.remaining}`].join(
        '<br/>',
      )
    },
  },
  xAxis: { type: 'category', data: labels.value, ...axisStyle, splitLine: { show: false } },
  yAxis: { type: 'value', minInterval: 1, ...axisStyle },
  series: [
    {
      name: 'Tomestone items',
      type: 'bar',
      stack: 'left',
      barMaxWidth: 28,
      itemStyle: barItemStyle(statusColors.tome),
      data: plan.burndown.value.map((p) => p.tome),
    },
    {
      name: 'Raid items',
      type: 'bar',
      stack: 'left',
      barMaxWidth: 28,
      itemStyle: barItemStyle(statusColors.raid),
      data: plan.burndown.value.map((p) => p.books),
    },
  ],
}))
</script>

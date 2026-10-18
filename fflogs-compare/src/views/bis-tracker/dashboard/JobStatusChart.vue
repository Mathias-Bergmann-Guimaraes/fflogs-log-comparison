<template>
  <a-card size="small" title="Gear status per job" class="h-full">
    <a-empty v-if="!jobs.length" :image="Empty.PRESENTED_IMAGE_SIMPLE" description="Change an item on a job to start tracking it" />
    <!-- Native scroll (not ECharts dataZoom) so the wheel works and the scrollbar matches the rest of the dashboard -->
    <div v-else class="overflow-y-auto [scrollbar-color:#434343_transparent] [scrollbar-width:thin]" :style="{ maxHeight: `${chartHeight(MAX_VISIBLE_JOBS)}px` }">
      <VChart :option="option" :style="{ height: `${chartHeight(jobs.length)}px` }" autoresize />
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Empty } from 'ant-design-vue'
import type { EChartsOption } from 'echarts'
import { EquipmentStatus } from '@/types/EquipmentType'
import { bisSlots } from '@/constants/bisSlots'
import { jobDisplayName } from '@/constants/jobs'
import { useBisPlan } from '@/composables/useBisPlan'
import { useBisStore } from '@/stores/bisStore'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { axisStyle, barItemStyle, legendStyle, statusColors, tooltipStyle } from './chartTheme'

const plan = useBisPlan()
const bis = useBisStore()
const favorites = useFavoritesStore()

// Taller than this many jobs, the rest scroll inside the card
const MAX_VISIBLE_JOBS = 10

const chartHeight = (rows: number) => Math.max(200, rows * 30 + 60)

// Top to bottom favorites first, then role order (ECharts draws category axes bottom-up)
const jobs = computed(() => [...plan.trackedJobs.value].reverse())

const count = (job: string, statuses: EquipmentStatus[]) => bisSlots.filter((_, i) => statuses.includes(bis.statusOf(job, i))).length

const series = computed(() => [
  { name: 'Acquired', color: statusColors.acquired, statuses: [EquipmentStatus.ACQUIRED] },
  { name: 'Needs upgrade', color: statusColors.upgrade, statuses: [EquipmentStatus.TWINE, EquipmentStatus.GLAZE] },
  { name: 'Tomestone', color: statusColors.tome, statuses: [EquipmentStatus.TOME] },
  { name: 'Raid', color: statusColors.raid, statuses: [EquipmentStatus.RAID] },
])

const option = computed<EChartsOption>(() => ({
  grid: { top: 36, right: 8, bottom: 8, left: 8, containLabel: true },
  legend: { ...legendStyle, top: 0, left: 0 },
  tooltip: { ...tooltipStyle, trigger: 'axis', axisPointer: { type: 'shadow' } },
  xAxis: { type: 'value', max: bisSlots.length, interval: 2, ...axisStyle },
  yAxis: {
    type: 'category',
    data: jobs.value.map((job) => (favorites.isFavorite(job) ? `★ ${jobDisplayName(job)}` : jobDisplayName(job))),
    ...axisStyle,
    // Finished jobs read green with a check, so they stand out from the full-but-not-done bars
    axisLabel: {
      ...axisStyle.axisLabel,
      formatter: (label: string, index: number) => (bis.isComplete(jobs.value[index]!) ? `{done|✓ ${label}}` : label),
      rich: { done: { color: statusColors.acquired, fontWeight: 'bold' } },
    },
    splitLine: { show: false },
  },
  series: series.value.map((s) => ({
    name: s.name,
    type: 'bar',
    stack: 'status',
    barMaxWidth: 18,
    itemStyle: barItemStyle(s.color),
    data: jobs.value.map((job) => count(job, s.statuses)),
  })),
}))
</script>

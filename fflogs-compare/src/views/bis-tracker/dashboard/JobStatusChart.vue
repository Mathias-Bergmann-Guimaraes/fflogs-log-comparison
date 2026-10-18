<template>
  <a-card size="small" title="Gear status per job" class="h-full">
    <a-empty v-if="!jobs.length" :image="Empty.PRESENTED_IMAGE_SIMPLE" description="Change an item on a job to start tracking it" />
    <VChart v-else :option="option" :style="{ height: `${Math.max(200, Math.min(jobs.length, MAX_VISIBLE_JOBS) * 30 + 60)}px` }" autoresize />
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

// Taller than this many jobs, the rest scroll inside the chart (mouse wheel or the slider on the right)
const MAX_VISIBLE_JOBS = 10

// Top to bottom favorites first, then role order (ECharts draws category axes bottom-up)
const jobs = computed(() => [...plan.trackedJobs.value].reverse())

const scrolls = computed(() => jobs.value.length > MAX_VISIBLE_JOBS)

const count = (job: string, statuses: EquipmentStatus[]) => bisSlots.filter((_, i) => statuses.includes(bis.statusOf(job, i))).length

const series = computed(() => [
  { name: 'Acquired', color: statusColors.acquired, statuses: [EquipmentStatus.ACQUIRED] },
  { name: 'Needs upgrade', color: statusColors.upgrade, statuses: [EquipmentStatus.TWINE, EquipmentStatus.GLAZE] },
  { name: 'Tomestone', color: statusColors.tome, statuses: [EquipmentStatus.TOME] },
  { name: 'Raid', color: statusColors.raid, statuses: [EquipmentStatus.RAID] },
])

const option = computed<EChartsOption>(() => ({
  grid: { top: 36, right: scrolls.value ? 28 : 8, bottom: 8, left: 8, containLabel: true },
  legend: { ...legendStyle, top: 0, left: 0 },
  tooltip: { ...tooltipStyle, trigger: 'axis', axisPointer: { type: 'shadow' } },
  xAxis: { type: 'value', max: bisSlots.length, interval: 2, ...axisStyle },
  yAxis: {
    type: 'category',
    data: jobs.value.map((job) => (favorites.isFavorite(job) ? `★ ${jobDisplayName(job)}` : jobDisplayName(job))),
    ...axisStyle,
    splitLine: { show: false },
  },
  // Starts at the top of the list: the last categories, since the axis is drawn bottom-up
  dataZoom: scrolls.value
    ? [
        {
          type: 'inside',
          yAxisIndex: 0,
          startValue: jobs.value.length - MAX_VISIBLE_JOBS,
          endValue: jobs.value.length - 1,
          zoomLock: true,
          zoomOnMouseWheel: false,
          moveOnMouseWheel: true,
        },
        {
          type: 'slider',
          yAxisIndex: 0,
          right: 4,
          width: 10,
          zoomLock: true,
          brushSelect: false,
          showDetail: false,
          showDataShadow: false,
          borderColor: 'transparent',
          backgroundColor: 'rgba(255,255,255,0.04)',
          fillerColor: 'rgba(255,255,255,0.2)',
          handleSize: 0,
          moveHandleSize: 0,
        },
      ]
    : [],
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

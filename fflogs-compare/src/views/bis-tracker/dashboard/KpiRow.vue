<template>
  <a-row :gutter="[16, 16]">
    <!-- BiS completion -->
    <a-col :xs="24" :sm="12" :xl="6">
      <a-card size="small" class="h-full">
        <div class="flex items-center gap-4">
          <a-progress type="circle" :percent="completion.percent" :size="72" :stroke-color="statusColors.acquired" />
          <div>
            <a-typography-text type="secondary" class="text-xs">BiS completion</a-typography-text>
            <div class="text-2xl font-semibold tabular-nums">{{ completion.acquired }} / {{ completion.total }}</div>
            <a-typography-text type="secondary" class="text-xs">
              items across {{ plan.trackedJobs.value.length }} tracked {{ plan.trackedJobs.value.length === 1 ? 'job' : 'jobs' }}
            </a-typography-text>
          </div>
        </div>
      </a-card>
    </a-col>

    <!-- Tomestones -->
    <a-col :xs="24" :sm="12" :xl="6">
      <a-card size="small" class="h-full">
        <div class="flex items-start gap-3">
          <a-avatar :src="tomeIcon" shape="square" :size="40" class="shrink-0 bg-gray-800! p-1" />
          <div class="min-w-0 flex-1">
            <a-typography-text type="secondary" class="text-xs">Weeks of tome capping</a-typography-text>
            <div class="text-2xl font-semibold tabular-nums">{{ weeksText(plan.tomeWeeks.value) }}</div>
            <a-typography-text type="secondary" class="text-xs tabular-nums">
              {{ plan.tomesNeeded.value.toLocaleString() }} needed · {{ stock.tomes.toLocaleString() }} held · {{ WEEKLY_TOME_CAP }}/week
            </a-typography-text>
            <a-progress :percent="tomePercent" size="small" :show-info="false" class="m-0!" />
          </div>
        </div>
      </a-card>
    </a-col>

    <!-- Raid -->
    <a-col :xs="24" :sm="12" :xl="6">
      <a-card size="small" class="h-full">
        <a-typography-text type="secondary" class="text-xs">Weeks of raiding (books only)</a-typography-text>
        <div class="text-2xl font-semibold tabular-nums">{{ weeksText(plan.raidWeeks.value) }}</div>
        <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <a-tooltip
            v-for="f in plan.floorWeeks.value"
            :key="f.floor"
            :title="`${f.label}: ${f.items} items, ${f.books} books (${stock.books[f.floor]} held)${f.coffers ? `, ${f.coffers} more covered by coffers` : ''}`"
          >
            <span class="inline-flex cursor-default items-center gap-1.5 text-xs tabular-nums">
              <floor-book :floor="f.floor" :size="18" />
              <span :class="f === plan.bottleneck.value ? 'font-semibold text-orange-400' : 'text-gray-300'">{{ f.weeks }}w</span>
            </span>
          </a-tooltip>
        </div>
        <a-typography-text v-if="plan.bottleneck.value" type="secondary" class="text-xs">
          Bottleneck: {{ plan.bottleneck.value.label }} ({{ plan.bottleneck.value.short }} books to go)
        </a-typography-text>
      </a-card>
    </a-col>

    <!-- Finish date -->
    <a-col :xs="24" :sm="12" :xl="6">
      <a-card size="small" class="h-full">
        <a-typography-text type="secondary" class="text-xs">Estimated BiS</a-typography-text>
        <div class="text-2xl font-semibold">
          {{ plan.doneDate.value ? (plan.doneWeek.value === 1 ? 'This week' : formatDate(plan.doneDate.value)) : 'Nothing to buy' }}
        </div>
        <a-typography-text v-if="plan.doneWeek.value > 1" type="secondary" class="text-xs">
          in {{ plan.doneWeek.value - 1 }} {{ plan.doneWeek.value - 1 === 1 ? 'reset' : 'resets' }}, if every book and tome goes to gear
        </a-typography-text>
        <a-divider class="my-2!" />
        <a-statistic-countdown :value="nextReset" format="D[d] HH[h] mm[m]" :value-style="{ fontSize: '14px' }">
          <template #title><span class="text-xs">Next weekly reset (Tue 08:00 UTC)</span></template>
        </a-statistic-countdown>
      </a-card>
    </a-col>
  </a-row>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { EquipmentStatus } from '@/types/EquipmentType'
import { bisSlots } from '@/constants/bisSlots'
import { equipmentStatusIcons } from '@/constants/icons'
import { useBisStore } from '@/stores/bisStore'
import { useStockStore } from '@/stores/stockStore'
import { WEEKLY_TOME_CAP, formatDate, nextWeeklyReset, useBisPlan } from '@/composables/useBisPlan'
import FloorBook from '../FloorBook.vue'
import { statusColors } from './chartTheme'

const plan = useBisPlan()
const bis = useBisStore()
const { stock } = storeToRefs(useStockStore())

const tomeIcon = equipmentStatusIcons[EquipmentStatus.TOME]
const nextReset = nextWeeklyReset().getTime()

const weeksText = (weeks: number) => (weeks === 0 ? 'Done' : weeks === 1 ? 'This week' : `${weeks} weeks`)

const completion = computed(() => {
  const jobs = plan.trackedJobs.value
  const total = jobs.length * bisSlots.length
  const acquired = jobs.reduce((sum, job) => sum + bisSlots.filter((_, i) => bis.statusOf(job, i) === EquipmentStatus.ACQUIRED).length, 0)
  return { acquired, total, percent: total ? Math.round((acquired / total) * 100) : 0 }
})

const tomePercent = computed(() => (plan.tomesNeeded.value ? Math.min(100, Math.round((stock.value.tomes / plan.tomesNeeded.value) * 100)) : 100))
</script>

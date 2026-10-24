<template>
  <!-- When judging is open, and this week's guide image as the bot posted it (server/fashion.ts) -->
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <a-tag :color="judging.open ? 'green' : 'default'" class="m-0!">{{ judging.open ? 'Judging open' : 'Judging closed' }}</a-tag>
      <a-typography-text type="secondary" class="text-xs">
        <template v-if="judging.open">Closes in {{ formatDuration(judging.closesAt - weekly.now) }} · {{ dateLabel(judging.closesAt) }}</template>
        <template v-else>Opens in {{ formatDuration(judging.opensAt - weekly.now) }} · {{ dateLabel(judging.opensAt) }}</template>
      </a-typography-text>
    </div>

    <!-- Nothing at all until this week's is in -->
    <template v-if="thisWeek">
      <a-image :src="thisWeek.image" alt="This week’s Fashion Report guide" width="100%" class="rounded" />
      <a-typography-text type="secondary" class="text-xs">Posted {{ dateLabel(thisWeek.postedAt) }}</a-typography-text>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { apiFetch } from '@/api/backend'
import { useWeeklyStore } from '@/stores/weeklyStore'
import { formatDuration } from '@/views/hunts/dashboard/trains'
import type { FashionReportInfo } from '@/types/weekly'

const DAY_MS = 24 * 3_600_000

const weekly = useWeeklyStore()
const info = ref<FashionReportInfo | null>(null)

// Judging runs from Friday 08:00 UTC to the weekly reset (Tuesday 08:00 UTC), four days later.
// Out of it, it next opens on the Friday before the coming reset.
const judging = computed(() => {
  const closesAt = weekly.resetsAt
  const opensAt = closesAt - 4 * DAY_MS
  return { open: weekly.now >= opensAt, opensAt, closesAt }
})

// A guide posted before this week's reset belongs to last week's theme
const thisWeek = computed(() => {
  const report = info.value?.report
  return report && report.postedAt >= weekly.resetsAt - 7 * DAY_MS ? report : null
})

// Again at the reset and when judging opens, when a new guide is likely to have come in
watch(
  () => [weekly.resetsAt, judging.value.open],
  async () => {
    try {
      info.value = await apiFetch<FashionReportInfo>('/fashion')
    } catch (err) {
      console.error("Couldn't load the Fashion Report guide", err)
    }
  },
  { immediate: true },
)

const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const dateLabel = (ms: number) => dateFormat.format(ms)
</script>

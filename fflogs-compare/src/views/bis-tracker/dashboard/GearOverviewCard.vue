<template>
  <a-card size="small" title="Gear overview" class="h-full">
    <!-- Sized by the card's own width (a container query), so it fits whatever size the widget is set to -->
    <div class="@container">
      <!-- Role groups flow side by side and wrap when they run out of room; a group too wide for the card wraps its own tiles -->
      <div class="flex flex-wrap gap-x-6 gap-y-3">
        <div v-for="group in jobsByRole" :key="group.role" class="max-w-full min-w-0">
          <a-typography-text type="secondary" class="mb-1.5 block text-xs">{{ group.role }}</a-typography-text>
          <div class="flex flex-wrap gap-1.5 @[32rem]:gap-2">
            <!-- One tile per job. Untracked jobs (nothing changed yet) are dimmed: they'd otherwise read as all Raid. -->
            <a-tooltip v-for="job in group.jobs" :key="job" :title="tileHint(job)">
              <!-- Opens this job's gear set on the Gear sets page -->
              <button
                type="button"
                class="flex cursor-pointer items-center gap-1.5 rounded-md bg-gray-800/60 p-1 transition hover:ring-2 hover:ring-blue-500 @[32rem]:gap-2 @[32rem]:p-1.5"
                :class="!bis.isTracked(job) && 'opacity-35'"
                @click="router.push({ name: 'bisGear', query: { job } })"
              >
                <!-- Job icons are 76px: 38px is exactly half -->
                <img :src="`/job/${job}.png`" :alt="jobDisplayName(job)" class="size-9.5 rounded-sm" />
                <!-- Column by column like JobBisCard: armour on the left, accessories on the right.
                     Small dots on narrow cards (5 rows of 6px + gaps = the icon's 38px), bigger from 32rem. -->
                <div class="grid grid-flow-col grid-rows-5 gap-x-0.75 gap-y-0.5 @[32rem]:gap-x-1">
                  <span
                    v-for="(_, slot) in bisSlots"
                    :key="slot"
                    class="size-1.5 rounded-full @[32rem]:size-2"
                    :style="{ backgroundColor: colorOf(bis.statusOf(job, slot)) }"
                    :aria-label="`${bisSlotLabels[slot]}: ${equipmentStatuses[bis.statusOf(job, slot)].label}`"
                  />
                </div>
              </button>
            </a-tooltip>
          </div>
        </div>
      </div>

      <!-- Legend under the tiles rather than in the header, where it would squeeze the title on narrow cards -->
      <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
        <span v-for="s in legend" :key="s.label" class="inline-flex items-center gap-1">
          <span class="size-2 rounded-full" :style="{ backgroundColor: s.color }" />
          {{ s.label }}
        </span>
      </div>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { EquipmentStatus } from '@/types/EquipmentType'
import { bisSlotLabels, bisSlots } from '@/constants/bisSlots'
import { equipmentStatuses } from '@/constants/equipmentStatus'
import { jobDisplayName, jobsByRole } from '@/constants/jobs'
import { useBisStore } from '@/stores/bisStore'
import { statusColors } from './chartTheme'

const bis = useBisStore()
const router = useRouter()

// Same blue/green/orange as the dashboard charts; raid is purple here
const RAID_COLOR = '#9b6ce0'

const legend = [
  { label: 'Have', color: statusColors.acquired },
  { label: 'Twine / Glaze', color: statusColors.upgrade },
  { label: 'Tome', color: statusColors.tome },
  { label: 'Raid', color: RAID_COLOR },
]

function colorOf(status: EquipmentStatus) {
  switch (status) {
    case EquipmentStatus.ACQUIRED:
      return statusColors.acquired
    case EquipmentStatus.TWINE:
    case EquipmentStatus.GLAZE:
      return statusColors.upgrade
    case EquipmentStatus.TOME:
      return statusColors.tome
    default:
      return RAID_COLOR
  }
}

// 'Dark Knight: 6/10 · 2 raid, 1 tome, 1 upgrade'
function tileHint(job: string) {
  if (!bis.isTracked(job)) return `${jobDisplayName(job)}: not tracked yet. Click to open its gear set`
  const statuses = bisSlots.map((_, slot) => bis.statusOf(job, slot))
  const count = (...wanted: EquipmentStatus[]) => statuses.filter((s) => wanted.includes(s)).length
  const left = [
    [count(EquipmentStatus.RAID), 'raid'],
    [count(EquipmentStatus.TOME), 'tome'],
    [count(EquipmentStatus.TWINE, EquipmentStatus.GLAZE), 'upgrade'],
  ]
    .filter(([n]) => n)
    .map(([n, label]) => `${n} ${label}`)
  const have = count(EquipmentStatus.ACQUIRED)
  return `${jobDisplayName(job)}: ${have}/${bisSlots.length}${left.length ? ` · ${left.join(', ')}` : ' · BiS done'}. Click to open its gear set`
}
</script>

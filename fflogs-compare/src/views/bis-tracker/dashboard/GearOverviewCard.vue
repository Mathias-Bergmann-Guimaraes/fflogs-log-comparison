<template>
  <a-card size="small" title="Gear overview" class="h-full">
    <!-- Sized by the card's own width (a container query), so it fits whatever size the widget is set to -->
    <div class="@container">
      <!-- Role groups flow side by side and wrap when they run out of room; a group too wide for the card wraps its own tiles -->
      <div class="flex flex-wrap gap-x-6 gap-y-3">
        <div v-for="group in jobsByRole" :key="group.role" class="max-w-full min-w-0">
          <a-typography-text type="secondary" class="mb-1.5 block text-xs">{{ group.role }}</a-typography-text>
          <div class="flex flex-wrap gap-1.5 @[32rem]:gap-2">
            <!-- One tile per job. Untracked jobs (nothing changed yet) are dimmed: they'd otherwise read as all Raid.
                 Finished sets get a green tint and a check badge; favorites keep their gold ring. -->
            <a-tooltip v-for="job in group.jobs" :key="job" :title="tileHint(job)">
              <!-- Opens this job's gear set on the Gear sets page -->
              <button
                type="button"
                class="relative flex cursor-pointer items-center gap-1.5 rounded-md p-1 transition hover:ring-2 hover:ring-blue-500 @[32rem]:gap-2 @[32rem]:p-1.5"
                :class="[
                  bis.isComplete(job) ? 'bg-green-500/20' : 'bg-gray-800/60',
                  !bis.isTracked(job) && 'opacity-35',
                  favorites.isFavorite(job) ? 'ring-2 ring-amber-400' : bis.isComplete(job) && 'ring-2 ring-green-500',
                ]"
                @click="router.push({ name: 'bisGear', query: { job } })"
              >
                <star-filled v-if="favorites.isFavorite(job)" class="absolute -top-1.5 -left-1.5 text-xs text-amber-400" />
                <check-circle-filled
                  v-if="bis.isComplete(job)"
                  class="absolute -top-1.5 -right-1.5 rounded-full bg-gray-900 text-sm text-green-500"
                />
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
import { CheckCircleFilled, StarFilled } from '@ant-design/icons-vue'
import { EquipmentStatus } from '@/types/EquipmentType'
import { bisSlotLabels, bisSlots } from '@/constants/bisSlots'
import { equipmentStatuses } from '@/constants/equipmentStatus'
import { jobDisplayName, jobsByRole } from '@/constants/jobs'
import { useBisStore } from '@/stores/bisStore'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { statusColors } from './chartTheme'

const bis = useBisStore()
const favorites = useFavoritesStore()
const router = useRouter()

// Same blue/green/orange as the dashboard charts; raid is purple here
const RAID_COLOR = '#9b6ce0'

const legend = [
  { label: 'Have', color: statusColors.acquired },
  { label: 'Twine / Glaze / Solvent', color: statusColors.upgrade },
  { label: 'Tome', color: statusColors.tome },
  { label: 'Raid', color: RAID_COLOR },
  { label: 'Other sources', color: statusColors.dungeon },
]

function colorOf(status: EquipmentStatus) {
  switch (status) {
    case EquipmentStatus.ACQUIRED:
      return statusColors.acquired
    case EquipmentStatus.TWINE:
    case EquipmentStatus.GLAZE:
    case EquipmentStatus.SOLVENT:
      return statusColors.upgrade
    case EquipmentStatus.TOME:
      return statusColors.tome
    case EquipmentStatus.DUNGEON:
    case EquipmentStatus.RELIC:
    case EquipmentStatus.TRIAL:
    case EquipmentStatus.ULTIMATE:
      return statusColors.dungeon
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
    [count(EquipmentStatus.TWINE, EquipmentStatus.GLAZE, EquipmentStatus.SOLVENT), 'upgrade'],
    [count(EquipmentStatus.DUNGEON), 'dungeon'],
    [count(EquipmentStatus.RELIC), 'relic'],
    [count(EquipmentStatus.TRIAL), 'trial'],
    [count(EquipmentStatus.ULTIMATE), 'ultimate'],
  ]
    .filter(([n]) => n)
    .map(([n, label]) => `${n} ${label}`)
  const have = count(EquipmentStatus.ACQUIRED)
  const name = favorites.isFavorite(job) ? `${jobDisplayName(job)} (favorite)` : jobDisplayName(job)
  if (bis.isComplete(job)) return `${name}: BiS complete! Click to open its gear set`
  return `${name}: ${have}/${bisSlots.length} · ${left.join(', ')}. Click to open its gear set`
}
</script>

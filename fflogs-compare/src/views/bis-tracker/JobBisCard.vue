<template>
  <a-card size="small" class="w-56" :body-style="{ padding: '8px 12px 12px' }">
    <template #title>
      <a-space :size="8">
        <a-avatar :src="jobIconPath(job)" shape="square" :size="24" />
        {{ displayName }}
      </a-space>
    </template>
    <template #extra>
      <a-tag :color="acquiredCount === bisSlots.length ? 'success' : undefined" class="m-0! tabular-nums">
        {{ acquiredCount }}/{{ bisSlots.length }}
      </a-tag>
    </template>

    <!-- Always rendered at the same height, so linked and unlinked cards' gear lines up -->
    <a-button type="text" size="small" block class="mb-3! flex! items-center gap-1.5" @click="dialogOpen = true">
      <link-outlined :class="linked.length ? 'text-blue-400' : 'text-gray-500'" />
      <template v-if="linked.length">
        <a-tooltip v-for="other in linked" :key="other" :title="sharedSummary(other)">
          <a-avatar
            :src="jobIconPath(other)"
            shape="square"
            :size="20"
            @mouseenter="bis.highlight = { job, other }"
            @mouseleave="bis.highlight = null"
          />
        </a-tooltip>
      </template>
      <span v-else class="text-gray-500">Link gear</span>
    </a-button>

    <!-- Fills column by column: armour on the left, accessories on the right, like the in-game character screen -->
    <div class="grid grid-flow-col grid-rows-5 justify-between gap-y-2.5 px-1">
      <!-- Wrapper owns the hover: a-dropdown (EquipmentSlot's root) doesn't pass mouse events through -->
      <div v-for="(slot, i) in bisSlots" :key="i" @mouseenter="bis.highlight = { job, slot: i }" @mouseleave="bis.highlight = null">
        <equipment-slot
          :status="bis.statusOf(job, i)"
          :type="slot"
          :linked-jobs="bis.linkedOnSlot(job, i)"
          :highlighted="bis.isHighlighted(job, i)"
          @update:status="bis.setStatus(job, i, $event)"
        />
      </div>
    </div>

    <!-- Raid drops still needed, per floor -->
    <div class="mt-3 flex justify-between border-t border-gray-700 px-1 pt-2.5">
      <a-tooltip v-for="f in raidFloors" :key="f.floor" :title="floorTooltip(f.floor)">
        <span class="inline-flex cursor-default items-center gap-1.5 text-xs tabular-nums">
          <floor-book :floor="f.floor" :size="20" />
          <span v-if="!bis.isTracked(job) || !f.slots.length" class="text-gray-500">–</span>
          <span v-else :class="raid[f.floor] === 0 ? 'text-green-400' : ''">{{ raid[f.floor] }}</span>
        </span>
      </a-tooltip>
    </div>

    <!-- What this set still needs; hover each for the items behind it -->
    <template #actions>
      <a-tooltip v-for="m in materialDefs" :key="m.key">
        <template #title>
          <div class="font-semibold">{{ m.label }}</div>
          <div v-for="line in breakdown[m.key]" :key="line">{{ line }}</div>
          <div v-if="!breakdown[m.key].length">None needed</div>
        </template>
        <span class="inline-flex items-center gap-1 tabular-nums" :class="needed[m.key] === 0 ? 'text-green-400' : ''">
          <img :src="m.icon" alt="" class="size-4" />
          {{ needed[m.key].toLocaleString() }}
        </span>
      </a-tooltip>
    </template>

    <link-gear-dialog v-model:open="dialogOpen" :job="job" />
  </a-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { LinkOutlined } from '@ant-design/icons-vue'
import EquipmentSlot from './EquipmentSlot.vue'
import LinkGearDialog from './LinkGearDialog.vue'
import FloorBook from './FloorBook.vue'
import { EquipmentStatus } from '@/types/EquipmentType'
import { bisSlotLabels, bisSlots } from '@/constants/bisSlots'
import { jobDisplayName } from '@/constants/jobs'
import { sharedSlots } from '@/constants/gearSharing'
import { materialDefs } from '@/constants/materials'
import { raidFloors, type RaidFloor } from '@/constants/raidFloors'
import { useBisStore, type Materials } from '@/stores/bisStore'

const props = defineProps<{
  job: string
}>()

const bis = useBisStore()
const dialogOpen = ref(false)

const acquiredCount = computed(() => bisSlots.filter((_, i) => bis.statusOf(props.job, i) === EquipmentStatus.ACQUIRED).length)

const displayName = computed(() => jobDisplayName(props.job))
const jobIconPath = (job: string) => `/job/${job}.png`

const linked = computed(() => bis.linkedWith(props.job))

// The full cost of this set, linked items included: that's what this job still needs
const needed = computed(() => bis.materialsNeeded([props.job]))

// Per material, the items behind the number: tomes -> ['Body: 825'], twines -> ['Body', 'Hands']
const breakdown = computed(() => {
  const lines: Record<keyof Materials, string[]> = { tomes: [], twines: [], glazes: [] }
  for (const p of bis.neededPieces([props.job])) {
    const label = bisSlotLabels[p.slot]!
    if (p.tomes) lines.tomes.push(`${label}: ${p.tomes}`)
    if (p.twines) lines.twines.push(label)
    if (p.glazes) lines.glazes.push(label)
  }
  return lines
})

const raid = computed(() => bis.booksNeeded([props.job]))

// 'Floor 2: Head, Feet (8 books)' / why there's no number
function floorTooltip(floor: RaidFloor) {
  const def = raidFloors.find((f) => f.floor === floor)!
  if (!def.slots.length) return `${def.label}: weapons aren't tracked yet`
  if (!bis.isTracked(props.job)) return `${def.label}: change any item to start tracking this job`
  const items = bis
    .raidPieces([props.job])
    .filter((p) => p.floor === floor)
    .map((p) => bisSlotLabels[p.slot])
  return items.length ? `${def.label}: ${items.join(', ')} (${items.length * def.bookCost} books)` : `${def.label}: nothing needed`
}

// 'Bard: shares all accessories' / 'Viper: shares Head, Body'
function sharedSummary(other: string) {
  const shareable = sharedSlots(props.job, other)
  const shared = shareable.filter((i) => bis.isLinked(props.job, other, i))
  const what =
    shared.length === shareable.length
      ? shareable.length === bisSlots.length
        ? 'all gear'
        : 'all accessories'
      : shared.map((i) => bisSlotLabels[i]).join(', ')
  return `${jobDisplayName(other)}: shares ${what}`
}
</script>

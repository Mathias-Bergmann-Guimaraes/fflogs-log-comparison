<template>
  <!-- Favorites get a gold border, matching the star; a finished set goes green (the star still marks a favorite) -->
  <a-card
    size="small"
    class="w-56"
    :class="
      complete ? 'border-green-500! shadow-[0_0_12px_rgba(34,197,94,0.3)]' : favorite && 'border-amber-400! shadow-[0_0_12px_rgba(251,191,36,0.25)]'
    "
    :body-style="{ padding: '8px 12px 12px' }"
  >
    <template #title>
      <a-space :size="8">
        <a-avatar :src="jobIconPath(job)" shape="square" :size="24" />
        {{ displayName }}
      </a-space>
    </template>
    <template #extra>
      <a-tooltip v-if="!setId" :title="favorite ? 'Favorite: bought and handed out first. Click to unstar' : 'Star to gear this job first'">
        <a-button type="text" size="small" class="mr-1" :aria-pressed="favorite" @click="favorites.toggle(job)">
          <template #icon>
            <star-filled v-if="favorite" class="text-amber-400" />
            <star-outlined v-else class="text-gray-500" />
          </template>
        </a-button>
      </a-tooltip>
      <a-tooltip v-if="complete" title="Every BiS item acquired">
        <a-tag color="success" class="m-0!">
          <template #icon><check-circle-filled /></template>
          Done
        </a-tag>
      </a-tooltip>
      <a-tag v-else class="m-0! tabular-nums">{{ acquiredCount }}/{{ bisSlots.length }}</a-tag>
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

    <!-- The weapon gets a row of its own, across the card. It's never linked, so it has no hover highlight. -->
    <div class="mb-3 px-1">
      <equipment-slot
        :status="bis.statusOf(job, WEAPON_SLOT)"
        :piece="bis.pieceOf(job, WEAPON_SLOT)"
        :type="EquipmentType.WEAPON"
        :ultimate="bis.hasUltimate(job)"
        :item-options="bis.itemOptions(job, WEAPON_SLOT)"
        :item-id="bis.itemOf(job, WEAPON_SLOT)"
        @update:status="bis.setStatus(job, WEAPON_SLOT, $event)"
        @update:item="bis.setItem(job, WEAPON_SLOT, $event)"
      />
    </div>

    <!-- Fills column by column: armour on the left, accessories on the right, like the in-game character screen -->
    <div class="grid grid-flow-col grid-rows-5 justify-between gap-y-2.5 px-1">
      <!-- Wrapper owns the hover: a-dropdown (EquipmentSlot's root) doesn't pass mouse events through -->
      <div v-for="i in gearSlots" :key="i" @mouseenter="bis.highlight = { job, slot: i }" @mouseleave="bis.highlight = null">
        <equipment-slot
          :status="bis.statusOf(job, i)"
          :piece="bis.pieceOf(job, i)"
          :type="bisSlots[i]!"
          :linked-jobs="bis.linkedOnSlot(job, i)"
          :highlighted="bis.isHighlighted(job, i)"
          :item-options="bis.itemOptions(job, i)"
          :item-id="bis.itemOf(job, i)"
          @update:status="bis.setStatus(job, i, $event)"
          @update:item="bis.setItem(job, i, $event)"
        />
      </div>
    </div>

    <!-- Raid drops still needed, per floor -->
    <div class="mt-3 flex justify-between border-t border-gray-700 px-1 pt-2.5">
      <a-tooltip v-for="f in raidFloors" :key="f.floor" :title="floorTooltip(f.floor)">
        <span class="inline-flex cursor-default items-center gap-1.5 text-xs tabular-nums">
          <floor-book :floor="f.floor" :size="20" />
          <span v-if="!bis.isTracked(job)" class="text-gray-500">–</span>
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
import { CheckCircleFilled, LinkOutlined, StarFilled, StarOutlined } from '@ant-design/icons-vue'
import EquipmentSlot from './EquipmentSlot.vue'
import LinkGearDialog from './LinkGearDialog.vue'
import FloorBook from './FloorBook.vue'
import { EquipmentStatus, EquipmentType } from '@/types/EquipmentType'
import { bisSlotLabels, bisSlots } from '@/constants/bisSlots'
import { jobDisplayName } from '@/constants/jobs'
import { ACCESSORY_SLOTS, ARMOUR_SLOTS, WEAPON_SLOT, sharedSlots } from '@/constants/gearSharing'
import { materialDefs } from '@/constants/materials'
import { raidFloors, type RaidFloor } from '@/constants/raidFloors'
import type { Materials } from '@/stores/bisStore'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { useGearSet } from './gearSetContext'

const props = defineProps<{
  job: string
}>()

const { store: bis, setId } = useGearSet()
const favorites = useFavoritesStore()
// Favorites set the dashboard's buying order, which only covers the default set: custom sets show no star or gold border
const favorite = computed(() => !setId && favorites.isFavorite(props.job))
const dialogOpen = ref(false)

// Everything but the weapon, which has its own row
const gearSlots = [...ARMOUR_SLOTS, ...ACCESSORY_SLOTS]

const acquiredCount = computed(() => bisSlots.filter((_, i) => bis.statusOf(props.job, i) === EquipmentStatus.ACQUIRED).length)
const complete = computed(() => bis.isComplete(props.job))

const displayName = computed(() => jobDisplayName(props.job))
const jobIconPath = (job: string) => `/job/${job}.png`

const linked = computed(() => bis.linkedWith(props.job))

// The full cost of this set, linked items included: that's what this job still needs
const needed = computed(() => bis.materialsNeeded([props.job]))

// Per material, the items behind the number: tomes -> ['Body: 825'], twines -> ['Body', 'Hands']
const breakdown = computed(() => {
  const lines: Record<keyof Materials, string[]> = { tomes: [], twines: [], glazes: [], solvents: [] }
  for (const p of bis.neededPieces([props.job])) {
    const label = bisSlotLabels[p.slot]!
    if (p.tomes) lines.tomes.push(`${label}: ${p.tomes}`)
    if (p.twines) lines.twines.push(label)
    if (p.glazes) lines.glazes.push(label)
    if (p.solvents) lines.solvents.push(label)
  }
  return lines
})

const raid = computed(() => bis.booksNeeded([props.job]))

// 'Floor 2: Head, Feet (8 books)' / why there's no number
function floorTooltip(floor: RaidFloor) {
  const def = raidFloors.find((f) => f.floor === floor)!
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
      ? shareable.length === gearSlots.length
        ? 'all gear'
        : 'all accessories'
      : shared.map((i) => bisSlotLabels[i]).join(', ')
  return `${jobDisplayName(other)}: shares ${what}`
}
</script>

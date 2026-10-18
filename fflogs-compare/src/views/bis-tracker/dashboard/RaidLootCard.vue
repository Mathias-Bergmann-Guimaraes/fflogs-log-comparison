<template>
  <a-card
    size="small"
    title="Who needs what"
    class="h-full"
    :tab-list="tabs"
    :active-tab-key="String(floor)"
    @tab-change="(key: string) => (floor = Number(key) as RaidFloor)"
  >
    <template #customTab="tab">
      <span class="flex items-center gap-1.5">
        <img :src="tab.icon" alt="" class="size-5" />
        {{ tab.tab }}
        <a-badge :count="tab.drops" :number-style="{ backgroundColor: '#434343', boxShadow: 'none' }" />
      </span>
    </template>

    <a-empty v-if="!rows.length" description="Weapons aren't tracked yet" />

    <div v-else class="flex flex-col divide-y divide-gray-700">
      <div v-for="row in rows" :key="row.key" class="flex items-center gap-4 py-2 first:pt-0 last:pb-0">
        <!-- Item icons are 40px, job icons 76px: 38px is exactly half (see ItemCell) -->
        <!-- At least as tall as a padded job block (38px + 2 x 2px) so every row matches -->
        <div class="flex min-h-10.5 w-36 shrink-0 items-center gap-3">
          <!-- Click when it drops: it goes into the stock (coffer, twine or glaze). Ticked until the weekly reset. -->
          <a-tooltip :title="itemHint(row)">
            <button
              type="button"
              class="relative shrink-0 cursor-pointer rounded-md transition hover:ring-2 hover:ring-blue-500 disabled:cursor-wait"
              :disabled="!!busy"
              :aria-label="itemHint(row)"
              @click="onItemClick(row)"
            >
              <img :src="row.icon" alt="" class="size-10 rounded-md" />
              <span
                v-if="loot.thisWeek[row.key]"
                class="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-gray-900 p-0.5"
              >
                <check-icon class="size-full" />
              </span>
            </button>
          </a-tooltip>
          <span class="leading-tight">{{ row.label }}</span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Who got it this week: they no longer need it, so it's shown here with a tick -->
          <a-tooltip v-if="given(row)" :title="`${names(given(row)!.jobs)} got it this week. Click to undo`">
            <button
              type="button"
              class="relative cursor-pointer rounded-md ring-2 ring-green-500 transition hover:brightness-125"
              :disabled="!!busy"
              @click="undoDrop(row)"
            >
              <div class="flex gap-0.5 rounded-md p-0.5" :class="given(row)!.jobs.length > 1 && 'bg-gray-700'">
                <img v-for="job in given(row)!.jobs" :key="job" :src="`/job/${job}.png`" :alt="jobDisplayName(job)" class="size-9.5 rounded-sm" />
              </div>
              <span class="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-gray-900 p-0.5">
                <check-icon class="size-full" />
              </span>
            </button>
          </a-tooltip>

          <a-typography-text v-if="!row.needs.length && !given(row)" type="secondary" class="text-xs">Nobody needs it</a-typography-text>

          <!-- Linked jobs share the item, so one drop covers the whole group. Click to give it to them. -->
          <a-tooltip v-for="need in row.needs" :key="need.jobs.join()" :title="needHint(row, need)">
            <a-badge :count="need.count > 1 ? `×${need.count}` : 0" :number-style="{ backgroundColor: '#1677ff' }">
              <button
                type="button"
                class="cursor-pointer rounded-md transition hover:ring-2 hover:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:ring-0"
                :disabled="!!busy || !givablePiece(row, need)"
                :aria-label="needHint(row, need)"
                @click="give(row, need)"
              >
                <!-- Same padding either way so rows with a linked group aren't taller -->
                <div class="flex gap-0.5 rounded-md p-0.5" :class="need.jobs.length > 1 && 'bg-gray-700'">
                  <img
                    v-for="job in need.jobs"
                    :key="job"
                    :src="`/job/${job}.png`"
                    :alt="jobDisplayName(job)"
                    class="size-9.5 rounded-sm"
                    :class="favorites.isFavorite(job) && 'ring-2 ring-amber-400'"
                  />
                </div>
              </button>
            </a-badge>
          </a-tooltip>
        </div>
      </div>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { EquipmentStatus, EquipmentType } from '@/types/EquipmentType'
import { bisSlotLabels, bisSlots } from '@/constants/bisSlots'
import { equipmentIcons, equipmentStatusIcons } from '@/constants/icons'
import { jobDisplayName } from '@/constants/jobs'
import { raidFloors, type RaidFloor } from '@/constants/raidFloors'
import { allJobs } from '@/composables/useBisPlan'
import { useBisStore } from '@/stores/bisStore'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { useStockStore } from '@/stores/stockStore'
import { useLootStore, type LootDrop } from '@/stores/lootStore'
import CheckIcon from '../CheckIcon.vue'

type Piece = { job: string; slot: number }
// One drop: `jobs` are linked and share it; `count` > 1 when they need several (both rings)
type Need = { jobs: string[]; count: number; pieces: Piece[] }
// item: a gear slot type, or the upgrade material the floor drops
type Row = { key: string; floor: RaidFloor; label: string; icon: string; item: EquipmentType | 'twine' | 'glaze'; needs: Need[] }

const bis = useBisStore()
const favorites = useFavoritesStore()
const stockStore = useStockStore()
const loot = useLootStore()
const floor = ref<RaidFloor>(1)
const busy = ref(false)

const withLinked = (job: string, slot: number) => [job, ...bis.linkedOnSlot(job, slot)].filter((j) => allJobs.includes(j))
const names = (jobs: string[]) => jobs.map(jobDisplayName).join(' + ')

// Groups pieces into needs, merging the same jobs needing the same item twice
function toNeeds(pieces: Piece[]): Need[] {
  const needs: Need[] = []
  for (const piece of pieces) {
    const jobs = withLinked(piece.job, piece.slot)
    const existing = needs.find((need) => need.jobs.join() === jobs.join())
    if (existing) {
      existing.count++
      existing.pieces.push(piece)
    } else needs.push({ jobs, count: 1, pieces: [piece] })
  }
  return needs
}

function rowsFor(floorNumber: RaidFloor): Row[] {
  const floorDef = raidFloors.find((f) => f.floor === floorNumber)!
  // Favorites first, so whoever you're gearing first is the first job on each row
  const pieces = bis.raidPieces(favorites.jobOrder).filter((p) => p.floor === floorNumber)

  // Both ring slots drop the same ring, so they share a row
  const rows: Row[] = []
  for (const type of new Set(floorDef.slots.map((slot) => bisSlots[slot]!))) {
    const slots = floorDef.slots.filter((slot) => bisSlots[slot] === type)
    rows.push({
      key: `type:${type}`,
      floor: floorNumber,
      label: slots.length > 1 ? `${bisSlotLabels[slots[0]!]!.replace(/ \d$/, '')}s` : bisSlotLabels[slots[0]!]!,
      icon: equipmentIcons[type],
      item: type,
      needs: toNeeds(pieces.filter((p) => slots.includes(p.slot))),
    })
  }

  if (floorDef.upgrade) {
    const kind = floorDef.upgrade
    const pieces = bis.neededPieces(favorites.jobOrder).filter((p) => (kind === 'twine' ? p.twines : p.glazes) > 0)
    rows.push({
      key: kind,
      floor: floorNumber,
      label: kind === 'twine' ? 'Twine' : 'Glaze',
      icon: equipmentStatusIcons[kind === 'twine' ? EquipmentStatus.TWINE : EquipmentStatus.GLAZE],
      item: kind,
      needs: toNeeds(pieces),
    })
  }
  return rows
}

const rows = computed(() => rowsFor(floor.value))

const tabs = computed(() =>
  raidFloors.map((f) => ({
    key: String(f.floor),
    tab: `Floor ${f.floor}`,
    icon: f.icon,
    drops: rowsFor(f.floor).reduce((sum, row) => sum + row.needs.reduce((n, need) => n + need.count, 0), 0),
  })),
)

const given = (row: Row) => loot.thisWeek[row.key]?.given ?? null

// --- Stock: a drop nobody takes goes into the coffers (gear) or the twine/glaze count ---

function addToStock(row: Row, amount: 1 | -1) {
  const stock = stockStore.stock
  const clamp = (n: number) => Math.min(99, Math.max(0, n + amount))
  if (row.item === 'twine') stock.twines = clamp(stock.twines)
  else if (row.item === 'glaze') stock.glazes = clamp(stock.glazes)
  else stock.coffers[row.item] = clamp(stock.coffers[row.item])
}

// Takes back whatever this row's drop did this week: out of the stock again, or the piece back to its old status
async function undoDrop(row: Row): Promise<boolean> {
  const drop = loot.thisWeek[row.key]
  if (!drop) return true
  if (drop.given) {
    busy.value = true
    try {
      if (!(await bis.setStatus(drop.given.job, drop.given.slot, drop.given.previous))) return false
    } finally {
      busy.value = false
    }
  } else addToStock(row, -1)
  loot.clear(row.key)
  // Last drop on the floor taken back: so is the clear this card marked (and its book)
  if (!loot.dropsOnFloor(row.floor) && loot.markedClear(row.floor)) {
    stockStore.setFloorCleared(row.floor, false)
    loot.setMarkedClear(row.floor, false)
  }
  return true
}

// Anything dropping means the floor was cleared: mark it done for the week and add its book,
// unless it's already marked (then the book was counted already)
function recordDrop(row: Row, given: LootDrop['given']) {
  loot.record(row.key, row.floor, given)
  if (stockStore.stock.floorsClearedThisWeek[row.floor]) return
  stockStore.setFloorCleared(row.floor, true)
  loot.setMarkedClear(row.floor, true)
}

async function onItemClick(row: Row) {
  if (loot.thisWeek[row.key]) return void (await undoDrop(row))
  addToStock(row, 1)
  recordDrop(row, null)
}

// --- Giving straight to a job or linked group ---

// The piece a drop would complete: a raid piece, or for twine/glaze a tome piece that's only missing its upgrade
function givablePiece(row: Row, need: Need): Piece | undefined {
  const wanted = row.item === 'twine' ? EquipmentStatus.TWINE : row.item === 'glaze' ? EquipmentStatus.GLAZE : EquipmentStatus.RAID
  return need.pieces.find((p) => bis.statusOf(p.job, p.slot) === wanted)
}

// One drop per row a week: giving replaces whatever this row's drop did before (e.g. the coffer it went into)
async function give(row: Row, need: Need) {
  const piece = givablePiece(row, need)
  if (!piece || !(await undoDrop(row))) return
  const previous = bis.statusOf(piece.job, piece.slot)
  busy.value = true
  try {
    if (!(await bis.setStatus(piece.job, piece.slot, EquipmentStatus.ACQUIRED))) return // store showed the error
  } finally {
    busy.value = false
  }
  recordDrop(row, { job: piece.job, slot: piece.slot, jobs: need.jobs, previous })
}

// --- Tooltips ---

function itemHint(row: Row) {
  const drop = loot.thisWeek[row.key]
  const into = row.item === 'twine' ? 'twines' : row.item === 'glaze' ? 'glazes' : 'coffers'
  if (drop?.given) return `Dropped this week and given to ${names(drop.given.jobs)}. Click to undo`
  if (drop) return `Dropped this week and added to your ${into}. Click to undo`
  return `Dropped? Click to add it to your ${into}, or click a job to give it to them`
}

function needHint(row: Row, need: Need) {
  const linked = need.jobs.length > 1 ? ' (linked, one drop covers all)' : ''
  const count = need.count > 1 ? `, needs ${need.count}` : ''
  if (!givablePiece(row, need)) return `${names(need.jobs)}${linked}${count}. Needs the tome piece before the ${row.label.toLowerCase()}`
  return `${names(need.jobs)}${linked}${count}. Click to give it to them`
}
</script>

<template>
  <!-- Body fills the card so the spend line sits at the bottom whatever the card's height -->
  <a-card size="small" title="Buy this week" class="flex! h-full flex-col!" :body-style="{ flex: 1, display: 'flex', flexDirection: 'column' }">
    <template #extra>
      <a-tag :color="purchases.length ? 'success' : undefined" class="m-0!">{{ purchases.length }} affordable</a-tag>
    </template>

    <!-- Always VISIBLE_ROWS tall; more items scroll -->
    <div class="overflow-y-auto [scrollbar-color:#434343_transparent] [scrollbar-width:thin]" :style="{ height: `${VISIBLE_ROWS * ROW_PX}px` }">
      <a-empty v-if="!rows.length" :image="Empty.PRESENTED_IMAGE_SIMPLE" description="Nothing affordable yet this week" />
      <a-list v-else :data-source="rows" :row-key="(r: { purchase: Purchase }) => r.purchase.id" size="small" :split="false">
        <template #renderItem="{ item }">
          <!-- A just-bought row stays put for UNDO_MS with a draining bar, then drops out -->
          <a-list-item class="relative px-0!" :style="{ height: `${ROW_PX}px` }">
            <item-cell :slot-index="item.purchase.slot" :jobs="item.purchase.jobs" :class="{ 'opacity-40': item.pending }" />
            <template #actions>
              <a-tooltip :title="currency(item.purchase)">
                <span class="inline-flex items-center gap-1.5 tabular-nums" :class="{ 'opacity-40': item.pending }">
                  <img v-if="item.purchase.source === 'tome'" :src="tomeIcon" alt="" class="size-4.5" />
                  <floor-book v-else :floor="item.purchase.source" :size="20" />
                  {{ item.purchase.cost.toLocaleString() }}
                </span>
              </a-tooltip>

              <a-tooltip v-if="item.pending" title="Undo: puts the item and your tomes/books back">
                <a-button danger :loading="busy === item.purchase.id" class="font-semibold!" @click="onUndo(item.purchase.id)">
                  <template #icon><undo-outlined class="bold-icon" /></template>
                  Undo
                </a-button>
              </a-tooltip>
              <a-tooltip v-else :title="boughtHint(item.purchase)">
                <a-button :loading="busy === item.purchase.id" :disabled="!!busy" class="font-semibold!" @click="onBought(item.purchase)">
                  <template #icon><check-outlined class="bold-icon" /></template>
                  Bought
                </a-button>
              </a-tooltip>
            </template>

            <div v-if="item.pending" class="undo-bar" :style="{ animationDuration: `${UNDO_MS}ms` }" />
          </a-list-item>
        </template>
      </a-list>
    </div>

    <div class="mt-auto pt-2">
      <a-divider class="mt-0! mb-2!" />
      <a-typography-text type="secondary" class="text-xs">{{ spendText }}</a-typography-text>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Empty } from 'ant-design-vue'
import { CheckOutlined, UndoOutlined } from '@ant-design/icons-vue'
import { EquipmentStatus } from '@/types/EquipmentType'
import { equipmentStatusIcons } from '@/constants/icons'
import { bisSlotLabels } from '@/constants/bisSlots'
import { equipmentStatuses } from '@/constants/equipmentStatus'
import { raidFloors } from '@/constants/raidFloors'
import { trackedFloors, useBisPlan, type Purchase } from '@/composables/useBisPlan'
import FloorBook from '../FloorBook.vue'
import ItemCell from './ItemCell.vue'

// How long a bought row stays (with its Undo button) before it leaves the list
const UNDO_MS = 8000

// The list is always this many rows tall and scrolls past it; a row is an ItemCell plus Ant's small padding
const VISIBLE_ROWS = 5
const ROW_PX = 60

const plan = useBisPlan()
const tomeIcon = equipmentStatusIcons[EquipmentStatus.TOME]

const purchases = computed(() => plan.thisWeek.value)
const tomeSpend = computed(() => purchases.value.filter((p) => p.source === 'tome').reduce((s, p) => s + p.cost, 0))
const bookSpend = computed(() =>
  trackedFloors
    .map((f) => ({ ...f, books: purchases.value.filter((p) => p.source === f.floor).reduce((s, p) => s + p.cost, 0) }))
    .filter((f) => f.books),
)

// 'Spend: 825 tomes, 9 Floor 1 books'
const spendText = computed(() =>
  ['Spend:', [`${tomeSpend.value.toLocaleString()} tomes`, ...bookSpend.value.map((f) => `${f.books} ${f.label} books`)].join(', ')].join(' '),
)

const currency = (p: Purchase) => (p.source === 'tome' ? `${p.cost} tomes` : `${p.cost} ${raidFloors.find((f) => f.floor === p.source)!.label} books`)

// 'Marks Body as Twine and pays 825 tomes'
function boughtHint(p: Purchase) {
  const status = equipmentStatuses[plan.statusAfterBuying(p)].label
  return `Marks ${bisSlotLabels[p.slot]} as ${status} and pays ${currency(p)}`
}

// --- Bought items waiting out their undo window ---

type Pending = { purchase: Purchase; index: number; undo: () => Promise<void>; timer: ReturnType<typeof setTimeout> }
const pending = ref<Record<string, Pending>>({})
const busy = ref<string | null>(null)

// Once bought an item leaves `purchases`; pending ones are put back where they were so nothing jumps
const rows = computed(() => {
  const list: { purchase: Purchase; pending: boolean }[] = purchases.value
    .filter((p) => !pending.value[p.id])
    .map((purchase) => ({ purchase, pending: false }))
  for (const entry of Object.values(pending.value).sort((a, b) => a.index - b.index)) {
    list.splice(Math.min(entry.index, list.length), 0, { purchase: entry.purchase, pending: true })
  }
  return list
})

function forget(id: string) {
  const entry = pending.value[id]
  if (!entry) return
  clearTimeout(entry.timer)
  delete pending.value[id]
}

async function onBought(p: Purchase) {
  const index = rows.value.findIndex((r) => r.purchase.id === p.id)
  busy.value = p.id
  try {
    const undo = await plan.buy(p)
    if (!undo) return // save failed; the store already showed the error
    pending.value[p.id] = { purchase: p, index, undo, timer: setTimeout(() => forget(p.id), UNDO_MS) }
  } finally {
    busy.value = null
  }
}

async function onUndo(id: string) {
  const entry = pending.value[id]
  if (!entry) return
  clearTimeout(entry.timer)
  busy.value = id
  try {
    await entry.undo()
  } finally {
    delete pending.value[id]
    busy.value = null
  }
}

// Leaving the page just keeps the purchases
onBeforeUnmount(() => Object.keys(pending.value).forEach(forget))
</script>

<style scoped>
/* Ant's outlined icons are thin filled paths; a matching stroke thickens them to sit with the semibold label */
.bold-icon :deep(path) {
  stroke: currentColor;
  stroke-width: 40;
}

/* Drains from full width to nothing over the undo window (duration set inline from UNDO_MS) */
.undo-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 100%;
  border-radius: 1px;
  background: #d32029;
  animation-name: undo-drain;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes undo-drain {
  from {
    width: 100%;
  }
  to {
    width: 0;
  }
}
</style>

<template>
  <!-- Body fills the card; when the row is taller than the content, the book and coffer rows spread out -->
  <a-card size="small" title="Your stock" class="flex! h-full flex-col!" :body-style="{ flex: 1, display: 'flex', flexDirection: 'column' }">
    <template #extra>
      <a-typography-text type="secondary" class="text-xs">Saved in this browser</a-typography-text>
    </template>

    <!-- Coffers in a right-hand column; they only stack underneath on phone-width screens -->
    <a-form layout="vertical" class="grid flex-1 gap-x-6 sm:grid-cols-[minmax(0,1fr)_auto] [&_.ant-form-item]:mb-3!">
      <!-- Container for the books' tier layout below -->
      <div class="flex flex-col @container">
        <!-- Each section resets on its own -->
        <div class="mb-2 flex items-center justify-between">
          <a-typography-text strong>Tomestones</a-typography-text>
          <a-button size="small" type="text" @click="reset('Tomestones', stockStore.resetTomes)">
            <template #icon><reload-outlined /></template>
            Reset
          </a-button>
        </div>
        <!-- Same two fixed-width columns as the books below, icons facing the middle -->
        <div class="grid grid-cols-[repeat(2,6rem)] gap-x-8">
          <div class="flex items-center gap-2">
            <div class="w-12 text-center">
              <a-input-number
                v-model:value="stock.tomes"
                :min="0"
                :max="MAX_TOMES_HELD"
                :precision="0"
                :controls="false"
                size="small"
                class="w-full! [&_input]:text-center! [&_input]:px-0!"
                aria-label="Tomestones held"
              />
              <div class="flex items-center justify-center gap-0.5 text-[11px] leading-none">
                <a-typography-text type="secondary">held</a-typography-text>
                <plugin-mark field="tomes" :value="stock.tomes" />
              </div>
            </div>
            <a-tooltip title="Tomestones held">
              <img :src="tomeIcon" alt="" class="size-10 rounded-md bg-gray-800 p-1" />
            </a-tooltip>
          </div>

          <div class="flex items-center gap-2">
            <a-tooltip :title="`Earned this week: ${stock.tomesEarnedThisWeek} / ${settings.weeklyTomeCap}`">
              <a-progress
                type="circle"
                :size="40"
                :stroke-width="10"
                :percent="Math.round((stock.tomesEarnedThisWeek / settings.weeklyTomeCap) * 100)"
                :show-info="false"
              />
            </a-tooltip>
            <div class="w-12 text-center">
              <a-input-number
                v-model:value="stock.tomesEarnedThisWeek"
                :min="0"
                :max="settings.weeklyTomeCap"
                :precision="0"
                :controls="false"
                size="small"
                class="w-full! [&_input]:text-center! [&_input]:px-0!"
                aria-label="Tomestones earned this week"
              />
              <div class="flex items-center justify-center gap-0.5 text-[11px] leading-none">
                <a-typography-text type="secondary">/ {{ settings.weeklyTomeCap }}</a-typography-text>
                <plugin-mark field="tomesEarnedThisWeek" :value="stock.tomesEarnedThisWeek" />
              </div>
            </div>
          </div>
        </div>

        <a-divider class="my-3!" />
        <div class="mb-2 flex items-center justify-between">
          <a-typography-text strong>Books &amp; upgrade materials</a-typography-text>
          <a-button size="small" type="text" @click="reset('Books & upgrade materials', stockStore.resetBooksAndUpgrades)">
            <template #icon><reload-outlined /></template>
            Reset
          </a-button>
        </div>

        <!-- Narrow: two columns, F1 F2 / F3 F4 / Twine Glaze.
             From 30rem (room for four columns): one column per tier, each upgrade material under the floor that drops it:
             F1 | F2 + Glaze | F3 + Twine | F4. Either way the icons face the middle (see bookLayout). -->
        <div class="grid flex-1 content-evenly grid-cols-[repeat(2,6rem)] gap-x-8 gap-y-2 @[30rem]:grid-cols-[repeat(4,6rem)]">
          <stock-counter
            v-for="f in raidFloors"
            :key="f.floor"
            v-model="stock.books[f.floor]"
            :label="`${f.label} book`"
            :plugin-field="`books.${f.floor}`"
            :class="bookLayout[f.floor].row"
          >
            <a-tooltip :title="clearedHint(f.floor)">
              <button
                type="button"
                class="relative flex size-10 cursor-pointer items-center justify-center rounded-md bg-gray-800 transition hover:ring-2 hover:ring-blue-500"
                :aria-label="clearedHint(f.floor)"
                :aria-pressed="stock.floorsClearedThisWeek[f.floor]"
                @click="toggleCleared(f.floor)"
              >
                <floor-book :floor="f.floor" :size="32" />
                <!-- Cleared this week: badge on the inner top corner (the floor number has the bottom one) -->
                <span
                  v-if="stock.floorsClearedThisWeek[f.floor]"
                  class="absolute -top-1.5 flex size-5 items-center justify-center rounded-full bg-gray-900 p-0.5"
                  :class="bookLayout[f.floor].badge"
                >
                  <check-icon class="size-full" />
                </span>
              </button>
            </a-tooltip>
          </stock-counter>

          <!-- Placed explicitly from 30rem: under Floor 3 (twine) and Floor 2 (glaze) -->
          <stock-counter
            v-model="stock.twines"
            label="twine"
            plugin-field="twines"
            class="flex-row-reverse @[30rem]:col-start-3 @[30rem]:row-start-2 @[30rem]:flex-row"
          >
            <a-tooltip title="Twines (drop from Floor 3)">
              <img :src="twineIcon" alt="Twines" class="size-10 rounded-md bg-gray-800 p-1" />
            </a-tooltip>
          </stock-counter>
          <stock-counter
            v-model="stock.glazes"
            label="glaze"
            plugin-field="glazes"
            class="@[30rem]:col-start-2 @[30rem]:row-start-2 @[30rem]:flex-row-reverse"
          >
            <a-tooltip title="Glazes (drop from Floor 2)">
              <img :src="glazeIcon" alt="Glazes" class="size-10 rounded-md bg-gray-800 p-1" />
            </a-tooltip>
          </stock-counter>
        </div>
        <a-typography-text type="secondary" class="mt-2 block text-xs"
          >Click a book when you clear its floor: adds the book and marks it done for the week</a-typography-text
        >
      </div>

      <div class="flex flex-col sm:border-l sm:border-gray-700 sm:pl-6">
        <a-divider class="my-3! sm:hidden!" />
        <div class="mb-2 flex items-center justify-between gap-4">
          <a-tooltip title="Each coffer holds one raid piece of its slot, for any job">
            <a-typography-text strong>Coffers</a-typography-text>
          </a-tooltip>
          <a-button size="small" type="text" @click="reset('Coffers', stockStore.resetCoffers)">
            <template #icon><reload-outlined /></template>
            Reset
          </a-button>
        </div>

        <!-- Fills column by column like JobBisCard: armour on the left, accessories on the right.
             The left column is reversed so both sides' icons sit in the middle. Empty ones are dimmed. -->
        <div class="grid flex-1 grid-flow-col grid-rows-5 justify-start gap-x-8 gap-y-2">
          <stock-counter
            v-for="c in cofferDefs"
            :key="c.type"
            v-model="stock.coffers[c.type]"
            :label="`${c.label} coffer`"
            :plugin-field="`coffers.${c.type}`"
            :reverse="!isAccessory(c.type)"
          >
            <coffer-menu :type="c.type" @given="(message, undo) => showUndo(`coffer-${c.type}`, message, undo)">
              <a-tooltip :title="`${c.label} coffer: click to give it to a job`">
                <button
                  type="button"
                  class="flex size-10 cursor-pointer items-center justify-center rounded-md bg-gray-800 transition hover:ring-2 hover:ring-blue-500"
                  :aria-label="`Give ${c.label} coffer`"
                >
                  <img v-if="c.icon" :src="c.icon" :alt="c.label" class="size-10 rounded-md" />
                  <!-- Placeholder until the coffer icons are added -->
                  <gift-outlined v-else class="text-lg text-gray-400" />
                </button>
              </a-tooltip>
            </coffer-menu>
          </stock-counter>
        </div>
      </div>
    </a-form>

    <context-holder />
  </a-card>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { storeToRefs } from 'pinia'
import { Button, notification } from 'ant-design-vue'
import { GiftOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { EquipmentStatus, isAccessory } from '@/types/EquipmentType'
import { equipmentStatusIcons } from '@/constants/icons'
import { raidFloors, type RaidFloor } from '@/constants/raidFloors'
import { cofferDefs } from '@/constants/coffers'
import { MAX_TOMES_HELD } from '@/constants/tomeCosts'
import { useSettingsStore } from '@/stores/settingsStore'
import { useStockStore } from '@/stores/stockStore'
import { useLootStore } from '@/stores/lootStore'
import FloorBook from '../FloorBook.vue'
import CofferMenu from './CofferMenu.vue'
import StockCounter from './StockCounter.vue'
import CheckIcon from '../CheckIcon.vue'
import PluginMark from '@/views/PluginMark.vue'

const stockStore = useStockStore()
const { stock } = storeToRefs(stockStore)
const loot = useLootStore()
const settings = useSettingsStore()

const tomeIcon = equipmentStatusIcons[EquipmentStatus.TOME]
const twineIcon = equipmentStatusIcons[EquipmentStatus.TWINE]
const glazeIcon = equipmentStatusIcons[EquipmentStatus.GLAZE]

// Which way each book faces so its icon points to the middle: narrow it's the left column
// (floors 1 and 3) that's mirrored, from 30rem the two left tiers (floors 1 and 2).
// row: StockCounter direction; badge: the cleared tick's inner corner. Full class names so Tailwind finds them.
const bookLayout: Record<RaidFloor, { row: string; badge: string }> = {
  1: { row: 'flex-row-reverse', badge: '-right-1.5' },
  2: { row: '@[30rem]:flex-row-reverse', badge: '-left-1.5 @[30rem]:left-auto @[30rem]:-right-1.5' },
  3: { row: 'flex-row-reverse @[30rem]:flex-row', badge: '-right-1.5 @[30rem]:right-auto @[30rem]:-left-1.5' },
  4: { row: '', badge: '-left-1.5' },
}

// Set by hand from here on, so "Who needs what" won't take this clear back when its drops are undone
function toggleCleared(floor: RaidFloor) {
  stockStore.setFloorCleared(floor, !stock.value.floorsClearedThisWeek[floor])
  loot.setMarkedClear(floor, false)
}

const clearedHint = (floor: RaidFloor) =>
  stock.value.floorsClearedThisWeek[floor]
    ? `Floor ${floor} cleared this week. Click to undo (takes its book back off)`
    : `Click when you clear Floor ${floor} this week: adds its book and locks the floor until reset`

// useNotification (not the static API) so it picks up the dark theme from a-config-provider
const [notify, ContextHolder] = notification.useNotification()

function reset(section: string, clear: () => () => void) {
  showUndo(`stock-reset-${section}`, `${section} reset`, clear())
}

// Bottom-right notice with an Undo button (resets and coffers given away)
function showUndo(key: string, message: string, undo: () => unknown) {
  notify.info({
    key,
    message,
    placement: 'bottomRight',
    duration: 6,
    btn: () =>
      h(
        Button,
        {
          size: 'small',
          onClick: () => {
            notify.destroy(key)
            undo()
          },
        },
        () => 'Undo',
      ),
  })
}
</script>

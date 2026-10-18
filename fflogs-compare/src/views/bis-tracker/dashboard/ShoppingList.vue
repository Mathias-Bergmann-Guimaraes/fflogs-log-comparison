<template>
  <a-card size="small" title="Shopping list" class="h-full">
    <template #extra>
      <a-typography-text type="secondary" class="text-xs">Linked items are one purchase · favorites bought first</a-typography-text>
    </template>

    <a-tabs v-model:active-key="tab" size="small">
      <!-- Tomestones -->
      <a-tab-pane key="tome">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <img :src="tomeIcon" alt="" class="size-4" /> Tomestones
            <a-badge :count="plan.tomePurchases.value.length" :number-style="countStyle" show-zero />
          </span>
        </template>
        <purchase-table :purchases="plan.tomePurchases.value" currency="tomes" :held="stock.tomes" />
      </a-tab-pane>

      <!-- Books, one tab per floor -->
      <a-tab-pane v-for="f in trackedFloors" :key="`floor-${f.floor}`">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <floor-book :floor="f.floor" :size="16" /> {{ f.label }}
            <a-badge :count="plan.bookPurchases.value[f.floor].length" :number-style="countStyle" show-zero />
          </span>
        </template>
        <purchase-table :purchases="plan.bookPurchases.value[f.floor]" :currency="`${f.label} books`" :held="stock.books[f.floor]" />
      </a-tab-pane>

      <!-- Upgrade materials -->
      <a-tab-pane key="upgrades">
        <template #tab>
          <span class="inline-flex items-center gap-1.5">
            <img :src="twineIcon" alt="" class="size-4" /> Upgrades
            <a-badge :count="plan.upgrades.value.items.length" :number-style="countStyle" show-zero />
          </span>
        </template>

        <a-table
          :data-source="plan.upgrades.value.items"
          :columns="upgradeColumns"
          row-key="id"
          size="small"
          :pagination="false"
          :scroll="{ y: VISIBLE_ROWS * ROW_HEIGHT }"
          class="fixed-rows-table"
          :style="fixedRowsStyle"
          :locale="{ emptyText: 'No upgrades needed' }"
        >
          <template #bodyCell="{ column, record }">
            <item-cell v-if="column.key === 'item'" :slot-index="record.slot" :jobs="record.jobs" source="tome" />
            <span v-else-if="column.key === 'kind'" class="inline-flex items-center gap-1.5">
              <img :src="record.kind === 'twine' ? twineIcon : glazeIcon" alt="" class="size-4" />
              {{ record.kind === 'twine' ? 'Twine' : 'Glaze' }}
            </span>
            <template v-else-if="column.key === 'state'">
              <a-tag v-if="record.needsTomePiece" color="processing" class="m-0!">Buy tome piece first</a-tag>
              <a-tag v-else color="warning" class="m-0!">Ready to upgrade</a-tag>
            </template>
          </template>

          <!-- Needed vs held, in the same summary row the other tabs use for totals -->
          <template #summary>
            <!-- fixed: pinned under the scrolling rows instead of after the last one -->
            <a-table-summary fixed>
              <a-table-summary-row>
                <a-table-summary-cell :index="0" :col-span="3">
                  <!-- One text line tall (22px), like the other tabs' summary rows -->
                  <div class="flex h-[22px] items-center gap-6">
                    <span v-for="m in upgradeTotals" :key="m.label" class="inline-flex items-center gap-1.5 tabular-nums">
                      <img :src="m.icon" alt="" class="size-4" />
                      <span class="font-semibold">{{ m.needed }}</span>
                      <a-typography-text type="secondary" class="text-xs">{{ m.label }} needed · {{ m.held }} held</a-typography-text>
                      <!-- Text, not tags: tags would make this row taller than the other tabs' -->
                      <a-typography-text v-if="m.short" type="warning" class="text-xs">· {{ m.short }} short</a-typography-text>
                      <a-typography-text v-else type="success" class="text-xs">· covered</a-typography-text>
                    </span>
                  </div>
                </a-table-summary-cell>
              </a-table-summary-row>
            </a-table-summary>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { TableColumnsType } from 'ant-design-vue'
import { EquipmentStatus } from '@/types/EquipmentType'
import { equipmentStatusIcons } from '@/constants/icons'
import { trackedFloors, useBisPlan } from '@/composables/useBisPlan'
import { useStockStore } from '@/stores/stockStore'
import FloorBook from '../FloorBook.vue'
import ItemCell from './ItemCell.vue'
import PurchaseTable from './PurchaseTable.vue'
import { ROW_HEIGHT, VISIBLE_ROWS, fixedRowsStyle } from './chartTheme'

const plan = useBisPlan()
const { stock } = storeToRefs(useStockStore())
const tab = ref('tome')

const tomeIcon = equipmentStatusIcons[EquipmentStatus.TOME]
const twineIcon = equipmentStatusIcons[EquipmentStatus.TWINE]
const glazeIcon = equipmentStatusIcons[EquipmentStatus.GLAZE]

const countStyle = { backgroundColor: '#303030', color: 'rgba(255,255,255,0.65)', boxShadow: 'none' }

const upgradeTotals = computed(() => [
  { label: 'twines', icon: twineIcon, needed: plan.upgrades.value.twines, held: stock.value.twines, short: plan.upgrades.value.twinesShort },
  { label: 'glazes', icon: glazeIcon, needed: plan.upgrades.value.glazes, held: stock.value.glazes, short: plan.upgrades.value.glazesShort },
])

const upgradeColumns: TableColumnsType = [
  { key: 'item', title: 'Item' },
  { key: 'kind', title: 'Material', width: 120 },
  { key: 'state', title: 'State', width: 170 },
]
</script>

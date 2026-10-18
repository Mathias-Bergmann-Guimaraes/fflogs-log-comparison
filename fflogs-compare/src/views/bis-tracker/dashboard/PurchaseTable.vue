<template>
  <!-- Fixed at VISIBLE_ROWS rows (empty or not) so switching tabs doesn't resize the card -->
  <a-table
    :data-source="purchases"
    :columns="columns"
    row-key="id"
    size="small"
    :pagination="false"
    :scroll="{ y: VISIBLE_ROWS * ROW_HEIGHT }"
    class="fixed-rows-table"
    :style="fixedRowsStyle"
    :locale="{ emptyText: 'Nothing to buy here' }"
  >
    <template #bodyCell="{ column, record, index }">
      <span v-if="column.key === 'order'" class="text-gray-500 tabular-nums">{{ index + 1 }}</span>
      <item-cell
        v-else-if="column.key === 'item'"
        :slot-index="record.slot"
        :jobs="record.jobs"
        :source="record.source === 'tome' ? 'tome' : 'raid'"
      />
      <span v-else-if="column.key === 'cost'" class="tabular-nums">{{ record.cost.toLocaleString() }}</span>
      <template v-else-if="column.key === 'upgrade'">
        <a-tooltip v-if="record.upgrade" :title="`Then needs a ${record.upgrade}`">
          <img :src="record.upgrade === 'twine' ? twineIcon : glazeIcon" alt="" class="size-4" />
        </a-tooltip>
      </template>
      <template v-else-if="column.key === 'when'">
        <a-tag v-if="record.week === 1" color="success" class="m-0!">This week</a-tag>
        <a-typography-text v-else type="secondary" class="text-xs whitespace-nowrap">{{ weekLabel(record.week) }}</a-typography-text>
      </template>
    </template>

    <template #summary>
      <!-- fixed: pinned under the scrolling rows instead of after the last one -->
      <a-table-summary fixed>
        <a-table-summary-row>
          <a-table-summary-cell :index="0" :col-span="2">
            <a-typography-text type="secondary">Total</a-typography-text>
          </a-table-summary-cell>
          <a-table-summary-cell :index="2" align="right">
            <span class="font-semibold tabular-nums">{{ total.toLocaleString() }}</span>
          </a-table-summary-cell>
          <a-table-summary-cell :index="3" :col-span="2">
            <a-typography-text type="secondary" class="text-xs">
              {{ held.toLocaleString() }} {{ currency }} held · {{ Math.max(0, total - held).toLocaleString() }} to go
            </a-typography-text>
          </a-table-summary-cell>
        </a-table-summary-row>
      </a-table-summary>
    </template>
  </a-table>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TableColumnsType } from 'ant-design-vue'
import { EquipmentStatus } from '@/types/EquipmentType'
import { equipmentStatusIcons } from '@/constants/icons'
import { weekLabel, type Purchase } from '@/composables/useBisPlan'
import ItemCell from './ItemCell.vue'
import { ROW_HEIGHT, VISIBLE_ROWS, fixedRowsStyle } from './chartTheme'

const props = defineProps<{ purchases: Purchase[]; currency: string; held: number }>()

const twineIcon = equipmentStatusIcons[EquipmentStatus.TWINE]
const glazeIcon = equipmentStatusIcons[EquipmentStatus.GLAZE]

const total = computed(() => props.purchases.reduce((sum, p) => sum + p.cost, 0))

const columns: TableColumnsType = [
  { key: 'order', title: '#', width: 44 },
  { key: 'item', title: 'Item' },
  { key: 'cost', title: 'Cost', width: 90, align: 'right' },
  { key: 'upgrade', title: '', width: 40, align: 'center' },
  { key: 'when', title: 'Affordable', width: 170 },
]
</script>

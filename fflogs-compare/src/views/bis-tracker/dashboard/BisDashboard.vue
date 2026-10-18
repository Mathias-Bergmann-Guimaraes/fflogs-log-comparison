<template>
  <a-row :gutter="[16, 16]">
    <template v-for="widget in layout.widgets" :key="widget.id">
      <a-col v-if="layout.editing || !widget.hidden" :xs="24" :xl="widget.span">
        <!-- Edit mode: drag the frame onto another widget to take its place -->
        <div
          v-if="layout.editing"
          draggable="true"
          class="flex h-full cursor-grab flex-col rounded-lg border-2 border-dashed p-2 transition-colors"
          :class="[
            dropTarget === widget.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600',
            dragged === widget.id && 'opacity-50',
          ]"
          @dragstart="onDragStart($event, widget.id)"
          @dragover.prevent="dropTarget = widget.id"
          @dragleave="dropTarget === widget.id && (dropTarget = null)"
          @drop.prevent="onDrop(widget.id)"
          @dragend="dragged = dropTarget = null"
        >
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <holder-outlined class="text-gray-400" />
            <a-typography-text strong class="mr-auto">{{ widgetTitles[widget.id] }}</a-typography-text>
            <a-segmented v-model:value="widget.span" size="small" :options="spanOptions" />
            <a-tooltip :title="widget.hidden ? 'Hidden: switch on to show it' : 'Shown: switch off to hide it'">
              <a-switch v-model:checked="widget.hidden" size="small" :checked-value="false" :un-checked-value="true" />
            </a-tooltip>
          </div>
          <!-- Preview only while editing, so dragging doesn't click into the widget -->
          <div class="pointer-events-none flex-1 select-none" :class="widget.hidden && 'opacity-30'">
            <component :is="widgetComponents[widget.id]" />
          </div>
        </div>

        <component :is="widgetComponents[widget.id]" v-else />
      </a-col>
    </template>

    <a-col v-if="!layout.editing && allHidden" :span="24">
      <a-empty description="All widgets are hidden. Use Customize to show some again." />
    </a-col>
  </a-row>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { HolderOutlined } from '@ant-design/icons-vue'
import { useDashboardLayoutStore, widgetTitles, type WidgetId } from '@/stores/dashboardLayoutStore'
import KpiRow from './KpiRow.vue'
import ThisWeekCard from './ThisWeekCard.vue'
import ShoppingList from './ShoppingList.vue'
import StockCard from './StockCard.vue'
import BurndownChart from './BurndownChart.vue'
import JobStatusChart from './JobStatusChart.vue'
import RoleTable from './RoleTable.vue'
import RaidLootCard from './RaidLootCard.vue'

const widgetComponents: Record<WidgetId, Component> = {
  kpis: KpiRow,
  thisWeek: ThisWeekCard,
  shopping: ShoppingList,
  stock: StockCard,
  burndown: BurndownChart,
  jobStatus: JobStatusChart,
  raidLoot: RaidLootCard,
  roles: RoleTable,
}

const spanOptions = [
  { label: '⅓', value: 8 },
  { label: '½', value: 12 },
  { label: '⅔', value: 16 },
  { label: 'Full', value: 24 },
]

const layout = useDashboardLayoutStore()
const allHidden = computed(() => layout.widgets.every((widget) => widget.hidden))

const dragged = ref<WidgetId | null>(null)
const dropTarget = ref<WidgetId | null>(null)

function onDragStart(event: DragEvent, id: WidgetId) {
  dragged.value = id
  // Firefox won't start a drag without some data
  event.dataTransfer?.setData('text/plain', id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDrop(targetId: WidgetId) {
  if (dragged.value) layout.move(dragged.value, targetId)
  dragged.value = dropTarget.value = null
}
</script>

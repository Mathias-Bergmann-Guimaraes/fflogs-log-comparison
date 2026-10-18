<template>
  <a-card size="small" class="h-full">
    <template #title>
      <span class="text-base">{{ dc.name }}</span>
      <a-typography-text type="secondary" class="ms-2 text-xs font-normal">last train per world</a-typography-text>
    </template>
    <template #extra>
      <a-typography-text type="secondary" class="text-xs">amber = respawned (3 to 6 h) · click a header to sort</a-typography-text>
    </template>

    <a-table :columns="columns" :data-source="rows" :pagination="false" size="small" row-key="world" :show-sorter-tooltip="false">
      <template #headerCell="{ column }">
        <template v-if="column.type">
          <a-tooltip :title="unnamed.includes(column.type.key) ? `No ping is named ${column.type.label} yet` : column.type.expansion">
            {{ column.type.label }}
            <WarningOutlined v-if="unnamed.includes(column.type.key)" class="text-orange-400" />
          </a-tooltip>
        </template>
      </template>

      <template #bodyCell="{ column, record }">
        <span v-if="column.key === 'world'" class="font-medium">{{ record.world }}</span>
        <template v-else-if="column.type">
          <a-tooltip :title="cellTooltip(record.cells[column.type.key], column.type.label, record.world)">
            <span class="inline-flex cursor-default items-center gap-1 tabular-nums">
              <template v-if="!record.cells[column.type.key].last">
                <a-typography-text type="secondary">—</a-typography-text>
              </template>
              <a-badge v-else-if="isActive(record.cells[column.type.key].last, now)" :status="record.cells[column.type.key].elapsed < 0 ? 'warning' : 'processing'" :text="cellText(record.cells[column.type.key])" />
              <template v-else>
                <a-typography-text :type="record.cells[column.type.key].respawn.phase === 'cooldown' ? 'secondary' : undefined">
                  {{ cellText(record.cells[column.type.key]) }}
                </a-typography-text>
                <FireOutlined v-if="oldest[column.type.key as TrainTypeKey] === record.world" class="text-orange-400" />
              </template>
            </span>
          </a-tooltip>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TableColumnType } from 'ant-design-vue'
import { FireOutlined, WarningOutlined } from '@ant-design/icons-vue'
import { relativeTime } from '../discordText'
import { DATA_CENTERS, TRAIN_TYPES, formatDuration, isActive, lastKey, respawnState, type Respawn, type Train, type TrainTypeKey } from './trains'

const props = defineProps<{
  dc: (typeof DATA_CENTERS)[number]
  last: Map<string, Train>
  now: number
  unnamed: TrainTypeKey[]
}>()

type Cell = { last: Train | null; elapsed: number | null; respawn: Respawn }
type Row = { world: string; cells: Record<TrainTypeKey, Cell> }

const rows = computed<Row[]>(() =>
  props.dc.worlds.map((world) => ({
    world,
    cells: Object.fromEntries(
      TRAIN_TYPES.map((t) => {
        const last = props.last.get(lastKey(world, t.key)) ?? null
        return [t.key, { last, elapsed: last ? props.now - last.startsAt : null, respawn: respawnState(last, props.now) }]
      }),
    ) as Record<TrainTypeKey, Cell>,
  })),
)

// Per column, the world that's waited longest among those fully respawned; it gets the flame
const oldest = computed(() =>
  Object.fromEntries(
    TRAIN_TYPES.map((t) => {
      const open = rows.value.filter((r) => r.cells[t.key].respawn.phase === 'open')
      return [t.key, open.sort((a, b) => b.cells[t.key].elapsed! - a.cells[t.key].elapsed!)[0]?.world]
    }),
  ) as Record<TrainTypeKey, string | undefined>,
)

// One hue (the dashboard's amber) for how far respawned: none while cooling down, growing through the
// 3 to 6 hour window, full once open. Text keeps its normal colour.
function tint(cell: Cell) {
  const r = cell.respawn
  const alpha = r.phase === 'open' ? 0.45 : r.phase === 'window' ? 0.08 + 0.27 * r.progress : 0
  return alpha ? `rgba(201, 133, 0, ${alpha.toFixed(3)})` : undefined
}

// Never seen sorts as the oldest: it's older than anything tracked
const sortValue = (cell: Cell) => cell.elapsed ?? Infinity

const columns = computed<TableColumnType<Row>[]>(() => [
  { key: 'world', title: 'World', width: 110 },
  ...TRAIN_TYPES.map((type) => ({
    key: type.key,
    type,
    align: 'center' as const,
    sorter: (a: Row, b: Row) => {
      const [x, y] = [sortValue(a.cells[type.key]), sortValue(b.cells[type.key])]
      return x === y ? 0 : x > y ? 1 : -1
    },
    sortDirections: ['descend', 'ascend'] as ('descend' | 'ascend')[],
    customCell: (record: Row) => ({ style: { background: tint(record.cells[type.key]) } }),
  })),
])

function cellText(cell: Cell) {
  if (cell.elapsed === null) return '—'
  if (cell.elapsed < 0) return `in ${formatDuration(cell.elapsed)}`
  if (isActive(cell.last!, props.now)) return 'running'
  return `${formatDuration(cell.elapsed)} ago`
}

function cellTooltip(cell: Cell, label: string, world: string) {
  if (!cell.last) return `No ${label} train on ${world} since tracking began`
  const when = new Date(cell.last.startsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  const r = cell.respawn
  const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { timeStyle: 'short' })
  const status =
    r.phase === 'open'
      ? 'Everything respawned, a train can start anytime.'
      : r.phase === 'window'
        ? `Respawning: ${Math.round(r.progress * 100)}% through the window, all up by ${time(r.fullAt)}.`
        : r.phase === 'cooldown'
          ? `Cooling down: earliest respawn ${time(r.opensAt)} (in ${formatDuration(r.opensAt - props.now)}).`
          : ''
  return `${when} (${relativeTime(cell.last.startsAt, props.now)})${cell.last.conductor ? ` · conductor ${cell.last.conductor}` : ''}. ${status}`
}
</script>

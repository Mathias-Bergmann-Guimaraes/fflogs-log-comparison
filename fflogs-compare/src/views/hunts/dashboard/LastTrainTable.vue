<template>
  <a-card size="small" class="h-full">
    <template #title>
      <span class="text-base">{{ dc.name }}</span>
      <a-typography-text type="secondary" class="ms-2 text-xs font-normal">last train per world</a-typography-text>
    </template>
    <template #extra>
      <a-typography-text type="secondary" class="text-xs">amber = respawning · green = all up · click a header to sort</a-typography-text>
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
            <a-tag v-if="isOpen(record.cells[column.type.key])" color="green" class="me-0! inline-flex! cursor-default items-center gap-1 rounded-full! px-2.5! text-sm! tabular-nums">
              {{ cellText(record.cells[column.type.key]) }}
              <svg v-if="oldest[column.type.key as TrainTypeKey] === record.world" viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-label="waited longest">
                <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5" />
                <circle cx="8" cy="8" r="3.5" />
              </svg>
            </a-tag>
            <span v-else class="inline-flex cursor-default items-center gap-1 rounded-full px-2.5 tabular-nums" :style="{ background: tint(record.cells[column.type.key]) }">
              <template v-if="!record.cells[column.type.key].last">
                <a-typography-text type="secondary">—</a-typography-text>
              </template>
              <a-badge v-else-if="isActive(record.cells[column.type.key].last, now)" :status="record.cells[column.type.key].elapsed < 0 ? 'warning' : 'processing'" :text="cellText(record.cells[column.type.key])" />
              <template v-else>
                <a-typography-text :type="record.cells[column.type.key].respawn.phase === 'cooldown' ? 'secondary' : undefined">
                  {{ cellText(record.cells[column.type.key]) }}
                </a-typography-text>              </template>
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
import { WarningOutlined } from '@ant-design/icons-vue'
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
        return [t.key, { last, elapsed: last ? props.now - last.startsAt : null, respawn: respawnState(last, t.key, props.now) }]
      }),
    ) as Record<TrainTypeKey, Cell>,
  })),
)

// Per column, the world that's waited longest among those fully respawned; it gets the record mark
const oldest = computed(() =>
  Object.fromEntries(
    TRAIN_TYPES.map((t) => {
      const open = rows.value.filter((r) => r.cells[t.key].respawn.phase === 'open')
      return [t.key, open.sort((a, b) => b.cells[t.key].elapsed! - a.cells[t.key].elapsed!)[0]?.world]
    }),
  ) as Record<TrainTypeKey, string | undefined>,
)

// Everything's up: shown as the same green tag RespawnTag uses for "open"
const isOpen = (cell: Cell) => !!cell.last && !isActive(cell.last, props.now) && cell.respawn.phase === 'open'

// While respawning, an amber pill behind the time that grows through the respawn window
function tint(cell: Cell) {
  if (!cell.last || isActive(cell.last, props.now)) return undefined
  const r = cell.respawn
  return r.phase === 'window' ? `rgba(201, 133, 0, ${(0.08 + 0.27 * r.progress).toFixed(3)})` : undefined
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

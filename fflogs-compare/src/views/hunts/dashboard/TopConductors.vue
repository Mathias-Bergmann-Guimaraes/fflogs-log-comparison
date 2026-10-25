<template>
  <a-card size="small" :title="`Top conductors (${DAYS} days)`" class="h-full">
    <a-empty v-if="!rows.length" :image="Empty.PRESENTED_IMAGE_SIMPLE" description="No conductor named in a post yet" />
    <a-table v-else :columns="columns" :data-source="rows" :pagination="false" size="small" row-key="name" :scroll="{ y: 300 }" class="thin-scroll-table">
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'rank'">
          <span :class="index < 3 ? 'font-semibold text-orange-400' : 'text-gray-500'">{{ index + 1 }}</span>
        </template>
        <template v-else-if="column.key === 'name'">
          <div class="font-medium">{{ record.name }}</div>
          <a-typography-text type="secondary" class="text-xs">mostly {{ record.world }} · last {{ relativeTime(record.lastAt, now) }}</a-typography-text>
        </template>
        <template v-else-if="column.key === 'types'">
          <span class="text-xs text-gray-400">{{ record.types || '—' }}</span>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Empty, type TableColumnType } from 'ant-design-vue'
import { relativeTime } from '../discordText'
import { TRAIN_TYPES, type Train } from './trains'

const props = defineProps<{ trains: Train[]; now: number }>()

const DAYS = 30
const TOP = 15

type Row = { name: string; count: number; world: string; types: string; lastAt: number }

const columns: TableColumnType<Row>[] = [
  { key: 'rank', title: '#', width: 40 },
  { key: 'name', title: 'Conductor' },
  { key: 'types', title: 'Runs', width: 90 },
  { key: 'count', dataIndex: 'count', title: 'Trains', width: 70, align: 'right' },
]

const rows = computed<Row[]>(() => {
  const byName = new Map<string, { name: string; trains: Train[] }>()
  for (const t of props.trains) {
    if (!t.conductor || t.startsAt > props.now || t.startsAt < props.now - DAYS * 86_400_000) continue
    // The same person types their name slightly differently now and then
    const key = t.conductor.toLowerCase().replace(/\s+/g, ' ')
    const entry = byName.get(key) ?? { name: t.conductor, trains: [] }
    entry.trains.push(t)
    byName.set(key, entry)
  }
  return [...byName.values()]
    .map(({ name, trains }) => {
      const worlds = new Map<string, number>()
      for (const t of trains) worlds.set(t.world, (worlds.get(t.world) ?? 0) + 1)
      const types = TRAIN_TYPES.filter((type) => trains.some((t) => t.types.includes(type.key)))
      return {
        name,
        count: trains.length,
        world: [...worlds].sort((a, b) => b[1] - a[1])[0]![0],
        types: types.map((type) => type.label).join(' · '),
        lastAt: Math.max(...trains.map((t) => t.startsAt)),
      }
    })
    .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
    .slice(0, TOP)
})
</script>

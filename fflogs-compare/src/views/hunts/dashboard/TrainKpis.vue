<template>
  <a-row :gutter="[16, 16]">
    <a-col :xs="24" :sm="12" :xl="6">
      <a-card size="small" class="h-full">
        <a-typography-text type="secondary" class="text-xs">Trains today</a-typography-text>
        <div class="text-2xl font-semibold tabular-nums">{{ today }}</div>
        <a-typography-text type="secondary" class="text-xs tabular-nums">{{ week }} in the last 7 days</a-typography-text>
      </a-card>
    </a-col>

    <a-col :xs="24" :sm="12" :xl="6">
      <a-card size="small" class="h-full">
        <a-typography-text type="secondary" class="text-xs">Running or announced</a-typography-text>
        <div class="text-2xl font-semibold tabular-nums">{{ active.length }}</div>
        <a-typography-text type="secondary" class="text-xs">
          <template v-if="nextStart">next starts {{ relativeTime(nextStart.startsAt, now) }} on {{ nextStart.world }}</template>
          <template v-else>nothing announced right now</template>
        </a-typography-text>
      </a-card>
    </a-col>

    <a-col :xs="24" :sm="12" :xl="6">
      <a-card size="small" class="h-full">
        <a-typography-text type="secondary" class="text-xs">Busiest world (7 days)</a-typography-text>
        <div class="text-2xl font-semibold">{{ busiest?.world ?? '—' }}</div>
        <a-typography-text type="secondary" class="text-xs tabular-nums">
          <template v-if="busiest">{{ busiest.count }} {{ busiest.count === 1 ? 'train' : 'trains' }} · {{ busiest.dc }}</template>
          <template v-else>no trains this week</template>
        </a-typography-text>
      </a-card>
    </a-col>

    <a-col :xs="24" :sm="12" :xl="6">
      <a-card size="small" class="h-full">
        <a-typography-text type="secondary" class="text-xs">Usual start (30 days)</a-typography-text>
        <div class="text-2xl font-semibold tabular-nums">{{ peakHour === null ? '—' : hourRange(peakHour.hour) }}</div>
        <a-typography-text type="secondary" class="text-xs tabular-nums">
          <template v-if="peakHour">{{ peakHour.count }} of {{ month.length }} trains started in this hour (your time)</template>
          <template v-else>not enough trains yet</template>
        </a-typography-text>
      </a-card>
    </a-col>
  </a-row>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { relativeTime } from '../discordText'
import { isActive, type Train } from './trains'

const props = defineProps<{ trains: Train[]; now: number }>()

const DAY_MS = 24 * 3_600_000

const started = computed(() => props.trains.filter((t) => t.startsAt <= props.now))
const today = computed(() => {
  const midnight = new Date(props.now).setHours(0, 0, 0, 0)
  return started.value.filter((t) => t.startsAt >= midnight).length
})
const week = computed(() => started.value.filter((t) => t.startsAt >= props.now - 7 * DAY_MS).length)
const month = computed(() => started.value.filter((t) => t.startsAt >= props.now - 30 * DAY_MS))

const active = computed(() => props.trains.filter((t) => isActive(t, props.now)))
const nextStart = computed(() =>
  props.trains.filter((t) => t.startsAt > props.now).reduce<Train | null>((a, t) => (!a || t.startsAt < a.startsAt ? t : a), null),
)

const busiest = computed(() => {
  const counts = new Map<string, { world: string; dc: string; count: number }>()
  for (const t of started.value.filter((t) => t.startsAt >= props.now - 7 * DAY_MS)) {
    const entry = counts.get(t.world) ?? { world: t.world, dc: t.dc, count: 0 }
    entry.count++
    counts.set(t.world, entry)
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null
})

const peakHour = computed(() => {
  if (month.value.length < 3) return null
  const counts = Array.from({ length: 24 }, () => 0)
  for (const t of month.value) counts[new Date(t.startsAt).getHours()]!++
  const hour = counts.indexOf(Math.max(...counts))
  return { hour, count: counts[hour]! }
})

const hourRange = (hour: number) => `${String(hour).padStart(2, '0')}:00–${String((hour + 1) % 24).padStart(2, '0')}:00`
</script>

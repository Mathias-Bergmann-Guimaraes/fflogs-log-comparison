<template>
  <a-card size="small" class="h-full">
    <template #title>
      <span class="text-base">{{ type.label }}</span>
      <a-typography-text type="secondary" class="ms-2 text-xs font-normal">{{ type.expansion }}</a-typography-text>
    </template>
    <template #extra>
      <a-tooltip v-if="gap" title="Median time between two trains of this expansion on the same world">
        <a-typography-text type="secondary" class="cursor-help text-xs tabular-nums">every ~{{ formatDuration(gap) }}</a-typography-text>
      </a-tooltip>
    </template>

    <a-empty v-if="!named" :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="`Name a ping &quot;${type.label}&quot; to track these`" />

    <template v-else>
      <div v-for="a in announced" :key="a.id" class="mb-2 text-xs">
        <a-badge :status="a.startsAt <= now ? 'processing' : 'warning'" />
        <span class="font-semibold">{{ a.world }}</span>
        {{ a.startsAt <= now ? `running for ${formatDuration(now - a.startsAt)}` : `starts ${relativeTime(a.startsAt, now)}` }}
      </div>

      <div v-for="dc in perDc" :key="dc.name" class="mb-3 last:mb-0">
        <div class="flex items-baseline gap-2">
          <a-typography-text type="secondary" class="text-xs tracking-wide uppercase">{{ dc.name }}</a-typography-text>
          <a-typography-text type="secondary" class="text-xs">{{ dc.summary }}</a-typography-text>
        </div>

        <div v-for="(s, i) in dc.top" :key="s.world" class="flex items-center gap-2 py-0.5">
          <span class="w-24 truncate" :class="i === 0 && dc.clear && 'font-semibold'">{{ s.world }}</span>
          <a-tag v-if="i === 0 && dc.clear" color="orange" class="me-0! text-xs">likely next</a-tag>
          <div class="flex-1" />
          <RespawnTag :respawn="s.respawn" :now="now" />
          <a-tooltip v-if="s.last" :title="`${new Date(s.last.startsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}${s.last.conductor ? ` · ${s.last.conductor}` : ''}`">
            <a-typography-text type="secondary" class="w-14 cursor-default text-right text-xs tabular-nums">{{ formatDuration(s.elapsed!) }} ago</a-typography-text>
          </a-tooltip>
          <span v-else class="w-14" />
        </div>

        <!-- Every world just had a train: say when the first one can go again -->
        <a-typography-text v-if="!dc.top.length && dc.nextOpen" type="secondary" class="text-xs">
          All cooling down. {{ dc.nextOpen.world }} opens first, in {{ formatDuration(dc.nextOpen.at - now) }}
        </a-typography-text>
      </div>
    </template>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Empty } from 'ant-design-vue'
import { relativeTime } from '../discordText'
import RespawnTag from './RespawnTag.vue'
import { DATA_CENTERS, TRAIN_TYPES, canStart, isActive, formatDuration, standings, typicalGap, type Train } from './trains'

const props = defineProps<{
  type: (typeof TRAIN_TYPES)[number]
  trains: Train[]
  last: Map<string, Train>
  now: number
  named: boolean
}>()

const TOP = 3

const gap = computed(() => typicalGap(props.trains, props.type.key))

const announced = computed(() =>
  props.trains.filter((t) => t.types.includes(props.type.key) && isActive(t, props.now)).sort((a, b) => a.startsAt - b.startsAt),
)

// Only worlds where a train can start are candidates (open, or in the 3 to 6 hour respawn window), longest ago first.
// The top one is only called "likely next" when it stands out: with several worlds never seen, any of them could be.
const perDc = computed(() =>
  DATA_CENTERS.map((dc) => {
    const all = standings(props.last, dc, props.type.key, props.now)
    const candidates = all.filter((s) => canStart(s.respawn))
    const count = (phases: string[]) => all.filter((s) => phases.includes(s.respawn.phase)).length
    const parts = [
      [count(['open', 'unseen']), 'open'],
      [count(['window']), 'respawning'],
      [count(['cooldown']), 'cooling down'],
    ] as const
    const nextOpen = all
      .flatMap((s) => (s.respawn.phase === 'cooldown' ? [{ world: s.world, at: s.respawn.opensAt }] : []))
      .sort((a, b) => a.at - b.at)[0]
    return {
      name: dc.name,
      top: candidates.slice(0, TOP),
      clear: candidates.filter((s) => s.respawn.phase === 'unseen').length <= 1,
      summary: parts
        .filter(([n]) => n)
        .map(([n, label]) => `${n} ${label}`)
        .join(' · '),
      nextOpen,
    }
  }),
)
</script>

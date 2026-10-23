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
          <a-typography-text type="secondary" class="text-xs">
            {{ dc.summary }}
            <!-- Worlds with no train since tracking began: nothing to rank them by, so just named on hover -->
            <template v-if="dc.unseen.length && dc.summary"> · </template>
            <a-tooltip v-if="dc.unseen.length" :title="`No train since tracking began, so everything should be up: ${dc.unseen.join(', ')}`">
              <span class="cursor-help underline decoration-dotted">{{ dc.unseen.length }} not seen</span>
            </a-tooltip>
          </a-typography-text>
        </div>

        <div v-for="(s, i) in dc.shown" :key="s.world" class="flex items-center gap-2 py-0.5">
          <span class="min-w-0 truncate" :class="i === 0 && dc.clear && 'font-semibold'">{{ s.world }}</span>
          <a-tag v-if="i === 0 && dc.clear" color="orange" class="me-0! shrink-0 text-xs">likely next</a-tag>
          <div class="flex-1" />
          <RespawnTag :respawn="s.respawn" :type="type.key" :now="now" />
          <a-tooltip :title="`${new Date(s.last!.startsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}${s.last!.conductor ? ` · ${s.last!.conductor}` : ''}`">
            <a-typography-text type="secondary" class="w-20 shrink-0 cursor-default text-right text-xs whitespace-nowrap tabular-nums">
              {{ formatDuration(s.elapsed!) }} ago
            </a-typography-text>
          </a-tooltip>
        </div>

        <a-button v-if="dc.hidden" type="link" size="small" class="h-auto! p-0! text-xs" @click="toggle(dc.name)">
          {{ expanded.has(dc.name) ? 'show less' : `+${dc.hidden} more` }}
        </a-button>

        <!-- Every world just had a train: say when the first one can go again -->
        <a-typography-text v-if="!dc.candidates && !dc.unseen.length && dc.nextOpen" type="secondary" class="text-xs">
          All cooling down. {{ dc.nextOpen.world }} opens first, in {{ formatDuration(dc.nextOpen.at - now) }}
        </a-typography-text>
      </div>
    </template>
  </a-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Empty } from 'ant-design-vue'
import { relativeTime } from '../discordText'
import RespawnTag from './RespawnTag.vue'
import { DATA_CENTERS, TRAIN_TYPES, isActive, formatDuration, standings, typicalGap, type Train } from './trains'

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

const expanded = ref(new Set<string>())
function toggle(dc: string) {
  const next = new Set(expanded.value)
  if (!next.delete(dc)) next.add(dc)
  expanded.value = next
}

// Worlds where a train can start (open, or in the respawn window), longest ago first. Worlds never seen
// are only counted in the summary: they have nothing to rank by and would otherwise crowd out the ones we know about.
// The top one is only called "likely next" when no unseen world could just as well be next.
const perDc = computed(() =>
  DATA_CENTERS.map((dc) => {
    const all = standings(props.last, dc, props.type.key, props.now)
    const candidates = all.filter((s) => s.respawn.phase === 'open' || s.respawn.phase === 'window')
    const unseen = all.filter((s) => s.respawn.phase === 'unseen').map((s) => s.world)
    const count = (phase: string) => all.filter((s) => s.respawn.phase === phase).length
    const parts = [
      [count('open'), 'open'],
      [count('window'), 'respawning'],
      [count('cooldown'), 'cooling down'],
    ] as const
    const nextOpen = all
      .flatMap((s) => (s.respawn.phase === 'cooldown' ? [{ world: s.world, at: s.respawn.opensAt }] : []))
      .sort((a, b) => a.at - b.at)[0]
    const shown = expanded.value.has(dc.name) ? candidates : candidates.slice(0, TOP)
    return {
      name: dc.name,
      shown,
      candidates: candidates.length,
      hidden: Math.max(0, candidates.length - TOP),
      unseen,
      clear: !unseen.length,
      summary: parts
        .filter(([n]) => n)
        .map(([n, label]) => `${n} ${label}`)
        .join(' · '),
      nextOpen,
    }
  }),
)
</script>

<template>
  <a-card v-if="!active.length" size="small">
    <a-typography-text type="secondary">No train running or announced right now. New ones show up here as soon as they're posted.</a-typography-text>
  </a-card>

  <a-row v-else :gutter="[16, 16]">
    <a-col v-for="train in active" :key="train.id" :xs="24" :sm="12" :xl="8" :xxl="6">
      <a-badge-ribbon :text="isRunning(train) ? 'Running' : 'Announced'" :color="isRunning(train) ? 'green' : 'orange'">
        <a-card size="small" class="h-full">
          <!-- Countdown ring, then where and which expansion -->
          <div class="flex items-center gap-4 pe-16">
            <a-progress
              type="circle"
              :size="84"
              :stroke-width="7"
              :percent="ringPercent(train)"
              :stroke-color="isRunning(train) ? RUNNING_COLOR : ANNOUNCED_COLOR"
              trail-color="rgba(255, 255, 255, 0.08)"
              class="shrink-0"
            >
              <template #format>
                <div class="leading-tight">
                  <div class="text-base font-semibold text-gray-100 tabular-nums">{{ clock(train) }}</div>
                  <div class="mt-0.5 text-[10px] tracking-wider text-gray-400 uppercase">{{ isRunning(train) ? 'running' : 'to start' }}</div>
                </div>
              </template>
            </a-progress>

            <div class="min-w-0">
              <div class="truncate text-xl leading-tight font-semibold">{{ train.world }}</div>
              <div class="mt-0.5 flex items-center gap-1.5 text-sm">
                <span class="inline-block size-2 rounded-full" :style="{ background: DC_COLORS[train.dc] }" />
                <span :style="{ color: DC_COLORS[train.dc] }">{{ train.dc }}</span>
                <a-typography-text type="secondary" class="text-xs">· {{ startTime(train) }}</a-typography-text>
              </div>
              <div class="mt-2 flex flex-wrap gap-1">
                <a-tag v-for="tag in expansionTags(train)" :key="tag.text" :color="tag.color" class="me-0! font-semibold">{{ tag.text }}</a-tag>
              </div>
            </div>
          </div>

          <a-divider class="my-3!" />

          <div class="flex flex-col gap-2 text-sm">
            <div class="flex items-start gap-2">
              <EnvironmentOutlined class="mt-1 text-gray-400" />
              <div v-if="train.start" class="min-w-0">
                <span class="font-medium">{{ train.start.aetheryte ?? train.start.zone }}</span>
                <a-typography-text v-if="(train.start.aetheryte && train.start.zone) || train.start.instance" type="secondary" class="text-xs">
                  · {{ [train.start.aetheryte && train.start.zone, train.start.instance && `Instance ${train.start.instance}`].filter(Boolean).join(' · ') }}
                </a-typography-text>
              </div>
              <a-typography-text v-else type="secondary">Starting point not in the post</a-typography-text>
            </div>

            <div v-if="train.speed" class="flex items-start gap-2">
              <component :is="speedIcon(train.speed)" class="mt-1 text-gray-400" />
              <div>
                <span class="font-medium">{{ train.speed.kind ? SPEED_LABELS[train.speed.kind] : train.speed.text }}</span>
                <a-typography-text v-if="train.speed.kind && train.speed.text.toLowerCase() !== SPEED_LABELS[train.speed.kind].toLowerCase()" type="secondary" class="ms-2 text-xs">
                  "{{ train.speed.text }}"
                </a-typography-text>
              </div>
            </div>

            <div v-if="train.conductor" class="flex items-start gap-2">
              <UserOutlined class="mt-1 text-gray-400" />
              <span class="truncate">{{ train.conductor }}</span>
            </div>

            <div class="flex items-start gap-2">
              <GiftOutlined class="mt-1 text-gray-400" />
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="font-medium">
                  {{ train.marks }} marks{{ train.types.length > 1 ? ' each' : '' }}
                  <a-tooltip v-if="!train.marksGiven" title="The post doesn't say how many, so this assumes a full train">
                    <a-typography-text type="secondary" class="text-xs font-normal">assumed</a-typography-text>
                  </a-tooltip>
                </span>
                <a-tooltip v-for="reward in trainRewards(train)" :key="reward.currency" :title="reward.currency">
                  <span class="inline-flex items-center gap-1 tabular-nums">
                    <img :src="currencyIcons[reward.currency]" :alt="reward.currency" class="size-5" />
                    {{ reward.amount }}
                  </span>
                </a-tooltip>
              </div>
            </div>
          </div>
        </a-card>
      </a-badge-ribbon>
    </a-col>
  </a-row>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { CoffeeOutlined, DashboardOutlined, EnvironmentOutlined, GiftOutlined, ThunderboltOutlined, UserOutlined } from '@ant-design/icons-vue'
import { currencyIcons } from '@/constants/icons'
import { pingColor, pingLabel, relativeTime } from '../discordText'
import { DC_COLORS, TRAIN_TYPES, isActive, trainRewards, trainTypeOfLabel, type SpeedKind, type Train, type TrainSpeed } from './trains'

const props = defineProps<{ trains: Train[]; now: number; labels: Record<string, string> }>()

// Soonest first: running ones (oldest start on top), then announced
const active = computed(() => props.trains.filter((t) => isActive(t, props.now)).sort((a, b) => a.startsAt - b.startsAt))

// The countdowns tick every second; which trains are shown still follows the store's slower clock (props.now)
const tick = ref(Date.now())
const ticker = setInterval(() => (tick.value = Date.now()), 1000)
onBeforeUnmount(() => clearInterval(ticker))

const isRunning = (train: Train) => train.startsAt <= tick.value

// Same as the ribbons and the header's alert dots
const RUNNING_COLOR = '#52c41a'
const ANNOUNCED_COLOR = '#faad14'

// Announced: fills from the post to the start. Running: fills through the time it counts as running (an estimate).
// Kept under 100, where the ring would switch to Ant's "success" look.
function ringPercent(train: Train) {
  const [from, to] = isRunning(train) ? [train.startsAt, train.endsAt] : [train.postedAt, train.startsAt]
  const share = to > from ? (tick.value - from) / (to - from) : 1
  return Math.min(99.5, Math.max(0, share * 100))
}

// m:ss to the start (h:mm:ss from an hour out); once running, how long it has been going
function clock(train: Train) {
  const seconds = Math.floor(Math.abs(train.startsAt - tick.value) / 1000)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

const startTime = (train: Train) => {
  const at = new Date(train.startsAt).toLocaleTimeString(undefined, { timeStyle: 'short' })
  return isRunning(train) ? `started ${relativeTime(train.startsAt, tick.value)}` : `at ${at}`
}

const SPEED_LABELS: Record<SpeedKind, string> = { fast: 'Fast', fastish: 'Fast-ish', slow: 'Slow' }
// Fast a lightning bolt, fast-ish a speedometer, slow a coffee (chill); an unrecognised "Speed: …" the speedometer too
const speedIcon = (speed: TrainSpeed) => (speed.kind === 'fast' ? ThunderboltOutlined : speed.kind === 'slow' ? CoffeeOutlined : DashboardOutlined)

// The expansion of each role ping, in the ping's colour (as on the A-Rank page); unnamed pings show as they are
function expansionTags(train: Train) {
  return train.pings
    .filter((ping) => ping.startsWith('role:'))
    .map((ping) => {
      const type = TRAIN_TYPES.find((t) => t.key === trainTypeOfLabel(props.labels[ping]))
      return { text: type ? `${type.label} ${type.expansion}` : pingLabel(ping, props.labels), color: pingColor(ping) }
    })
}
</script>

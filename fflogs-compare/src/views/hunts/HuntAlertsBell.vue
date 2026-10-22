<template>
  <!-- Expanded, each alert sits in the header with its dot; the arrow folds them away (remembered) -->
  <template v-if="alerts.length">
    <div v-if="expanded" class="flex items-center gap-1">
      <a-tooltip v-for="alert in shownAlerts" :key="alert.id" :title="alert.text" placement="bottom">
        <a-tag :bordered="false" class="me-0! flex! cursor-pointer items-center gap-1 bg-white/10! text-gray-200!" @click="openDashboard">
          <a-badge v-bind="dotOf(alert)" />
          {{ alert.world }}
          <span class="text-gray-400">{{ alert.dc }}</span>
        </a-tag>
      </a-tooltip>
      <a-tag v-if="alerts.length > shownAlerts.length" :bordered="false" class="me-0! cursor-pointer bg-white/10! text-gray-200!" @click="popoverOpen = true">
        +{{ alerts.length - shownAlerts.length }}
      </a-tag>
    </div>
    <a-tooltip :title="expanded ? 'Hide hunt alerts' : 'Show hunt alerts'" placement="bottom">
      <a-button type="text" size="small" class="text-gray-400!" :aria-label="expanded ? 'Hide hunt alerts' : 'Show hunt alerts'" :aria-expanded="expanded" @click="toggleExpanded">
        <template #icon><RightOutlined v-if="expanded" class="text-xs" /><LeftOutlined v-else class="text-xs" /></template>
      </a-button>
    </a-tooltip>
  </template>

  <a-popover v-model:open="popoverOpen" placement="bottomRight" trigger="click" :overlay-style="{ width: '320px' }">
    <a-tooltip :title="title" placement="bottom">
      <a-button type="text" class="text-gray-300!" :aria-label="title">
        <template #icon>
          <a-badge :dot="!!top" :color="top ? dotOf(top).color : undefined" :offset="[-2, 2]">
            <BellOutlined class="text-gray-300! text-base" />
          </a-badge>
        </template>
      </a-button>
    </a-tooltip>

    <template #title>
      <div class="flex items-center justify-between">
        <span>Hunt alerts</span>
        <a-button type="link" size="small" class="px-0!" @click="openSettings">
          <template #icon><SettingOutlined /></template>
          Edit
        </a-button>
      </div>
    </template>

    <template #content>
      <a-list v-if="alerts.length" size="small" :data-source="sorted" :split="true">
        <template #renderItem="{ item }">
          <a-list-item class="px-0!">
            <a-list-item-meta>
              <template #avatar><a-badge v-bind="dotOf(item)" /></template>
              <template #title>
                {{ item.world }}
                <a-typography-text type="secondary" class="font-normal">{{ item.dc }}</a-typography-text>
              </template>
              <template #description>{{ item.text }}</template>
            </a-list-item-meta>
          </a-list-item>
        </template>
      </a-list>
      <a-typography-text v-else type="secondary">Nothing matching your alerts is up right now.</a-typography-text>

      <a-button block class="mt-3" @click="openDashboard">Train dashboard</a-button>
    </template>
  </a-popover>

  <HuntAlertsModal v-model:open="settingsOpen" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { BellOutlined, LeftOutlined, RightOutlined, SettingOutlined } from '@ant-design/icons-vue'
import { useHuntTrainsStore } from '@/stores/huntTrainsStore'
import type { HuntRank } from '@/types/hunts'
import { relativeTime } from './discordText'
import type { DataCenterName } from './dashboard/trains'
import HuntAlertsModal from './dashboard/HuntAlertsModal.vue'

// In the header, so the user sees a hunt they asked for (see the alert rules) from any page.
// An A rank is a train (announced, then running); an S rank is a single mark, so it has no such stages.
type HuntAlert = { id: string; rank: HuntRank; running: boolean; world: string; dc: DataCenterName; at: number; text: string }

const router = useRouter()
const { alertTrains, now } = storeToRefs(useHuntTrainsStore())

// S ranks join here once they're tracked, from their own store, already filtered by the alert rules
const alerts = computed<HuntAlert[]>(() =>
  alertTrains.value.map((train) => {
    const running = train.startsAt <= now.value
    return {
      id: train.id,
      rank: 'A',
      running,
      world: train.world,
      dc: train.dc,
      at: train.startsAt,
      text: `A rank train · ${running ? 'started' : 'starts'} ${relativeTime(train.startsAt, now.value)}`,
    }
  }),
)

// Red for an S rank, the rarest and most urgent; for a train, like the dashboard's ribbons: green while it runs,
// orange while it's still to come. Ant's own colours. A custom colour on 'processing' keeps its pulse (alone it's blue).
const S_RANK_COLOR = '#f5222d'
const RUNNING_COLOR = '#52c41a'
const ANNOUNCED_COLOR = '#faad14'
function dotOf(alert: HuntAlert) {
  if (alert.rank === 'S') return { status: 'processing' as const, color: S_RANK_COLOR }
  return alert.running ? { status: 'processing' as const, color: RUNNING_COLOR } : { status: 'warning' as const, color: ANNOUNCED_COLOR }
}

// The bell takes the colour of the most pressing alert: an S rank, else a running train, else an announced one
const urgency = (alert: HuntAlert) => (alert.rank === 'S' ? 2 : alert.running ? 1 : 0)
const top = computed(() => alerts.value.reduce<HuntAlert | null>((best, a) => (!best || urgency(a) > urgency(best) ? a : best), null))

const title = computed(() => {
  const alert = top.value
  if (!alert) return 'Hunt alerts'
  const dcs = [...new Set(alerts.value.filter((a) => urgency(a) === urgency(alert)).map((a) => a.dc))].join(' and ')
  if (alert.rank === 'S') return `An S rank is up on ${dcs}`
  return `A hunt train is ${alert.running ? 'running' : 'announced'} on ${dcs}`
})

// More than this in the header and the rest are a "+N" that opens the list. S ranks first, then soonest first.
const MAX_SHOWN = 3
const sorted = computed(() => [...alerts.value].sort((a, b) => urgency(b) - urgency(a) || a.at - b.at))
const shownAlerts = computed(() => sorted.value.slice(0, MAX_SHOWN))

// Open or folded, per browser; storage can be unavailable (private window), then it starts folded
const EXPANDED_KEY = 'huntAlertsExpanded'
const expanded = ref(readExpanded())
function readExpanded() {
  try {
    return localStorage.getItem(EXPANDED_KEY) === '1'
  } catch {
    return false
  }
}
function toggleExpanded() {
  expanded.value = !expanded.value
  try {
    localStorage.setItem(EXPANDED_KEY, expanded.value ? '1' : '0')
  } catch {
    // Not remembered then; it still toggles
  }
}

const popoverOpen = ref(false)
const settingsOpen = ref(false)

function openSettings() {
  popoverOpen.value = false
  settingsOpen.value = true
}

function openDashboard() {
  popoverOpen.value = false
  router.push({ name: 'huntsDashboard' })
}
</script>

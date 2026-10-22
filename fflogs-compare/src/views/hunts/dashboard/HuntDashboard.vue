<template>
  <a-result
    v-if="data && !data.enabled"
    status="info"
    title="The hunt feed isn't set up"
    sub-title="Set HUNT_INGEST_SECRET (or DISCORD_BOT_TOKEN and DISCORD_HUNT_CHANNEL_ID) in the server's .env and restart it (see the README)."
  />

  <a-spin v-else :spinning="loading && !data">
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <a-typography-text type="secondary">
        <template v-if="trackingSince">
          {{ trains.length }} A rank {{ trains.length === 1 ? 'train' : 'trains' }} tracked since
          {{ new Date(trackingSince).toLocaleDateString(undefined, { dateStyle: 'medium' }) }}
        </template>
        <template v-else-if="data">No A rank trains received yet</template>
      </a-typography-text>
      <a-tooltip v-if="unparsed" :title="`Posts in the train channels with no EU world name in them (chatter, cancellations, ...)`">
        <a-typography-text type="secondary" class="cursor-help text-xs">· {{ unparsed }} posts skipped</a-typography-text>
      </a-tooltip>
      <div class="flex-1" />
      <a-button @click="alertsOpen = true">
        <template #icon><BellOutlined /></template>
        Alerts
      </a-button>
      <a-button :loading="loading" @click="load"><template #icon><ReloadOutlined /></template></a-button>
    </div>

    <a-alert v-if="unnamedTypes.length" type="info" show-icon class="mb-4!">
      <template #message>
        No ping is named {{ unnamedTypes.map((t) => `"${t.label}"`).join(', ') }} yet, so those trains can't be told apart.
      </template>
      <template #description>
        Trains are sorted by their expansion role ping. Open the <router-link :to="{ name: 'huntsA' }">EU A-Rank</router-link> page, use
        <em>Name pings</em>, and name each role after its expansion, e.g. "{{ unnamedTypes[0]!.label }}" or "{{ unnamedTypes[0]!.expansion }}".
      </template>
    </a-alert>

    <a-row :gutter="[16, 16]">
      <!-- A rank trains and S ranks side by side and level (two rows of cards each, then they scroll), each with the last day per DC -->
      <a-col :xs="24" :xl="12">
        <div class="flex h-full flex-col gap-4">
          <HuntSection title="A rank trains" :count="activeTrainCount" color="#52c41a">
            <template #extra><HuntFilter v-model="filters.a" :groups="A_FILTERS" /></template>
            <UpcomingTrains :trains="shownTrains" :now="now" :labels="labels" />
          </HuntSection>
          <DcSparkline :events="trainEvents" :now="now" label="Trains" caption="Trains started per hour, last 24 hours" />
        </div>
      </a-col>
      <a-col :xs="24" :xl="12">
        <div class="flex h-full flex-col gap-4">
          <HuntSection title="S ranks" :count="sRankUpCount" color="#f5222d">
            <template #extra><HuntFilter v-model="filters.s" :groups="S_FILTERS" /></template>
            <SRankCards :s-ranks="shownSRanks" :now="now" />
          </HuntSection>
          <DcSparkline :events="sRankEvents" :now="now" label="S ranks" caption="S ranks reported per hour, last 24 hours" />
        </div>
      </a-col>
      <a-col :span="24">
        <TrainKpis :trains="trains" :now="now" />
      </a-col>
      <a-col v-for="type in TRAIN_TYPES" :key="type.key" :xs="24" :sm="12" :xxl="6">
        <NextTrainCard :type="type" :trains="trains" :last="last" :now="now" :named="!unnamedTypes.includes(type)" />
      </a-col>
      <a-col v-for="dc in DATA_CENTERS" :key="dc.name" :xs="24" :xl="12">
        <LastTrainTable :dc="dc" :last="last" :now="now" :unnamed="unnamedTypes.map((t) => t.key)" />
      </a-col>
      <a-col :xs="24" :xl="16">
        <TrainHeatmap :trains="trains" :now="now" />
      </a-col>
      <a-col :xs="24" :xl="8">
        <TopConductors :trains="trains" :now="now" />
      </a-col>
    </a-row>
  </a-spin>

  <HuntAlertsModal v-model:open="alertsOpen" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { message } from 'ant-design-vue'
import { BellOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { useHuntTrainsStore } from '@/stores/huntTrainsStore'
import { DATA_CENTERS, TRAIN_TYPES, isActive, lastTrains, trainTypeOfLabel } from './trains'
import { EXPANSIONS, isUp } from './sRanks'
import TrainKpis from './TrainKpis.vue'
import DcSparkline from './DcSparkline.vue'
import HuntSection from './HuntSection.vue'
import HuntFilter, { type FilterGroup, type FilterValue } from './HuntFilter.vue'
import SRankCards from './SRankCards.vue'
import UpcomingTrains from './UpcomingTrains.vue'
import NextTrainCard from './NextTrainCard.vue'
import LastTrainTable from './LastTrainTable.vue'
import TrainHeatmap from './TrainHeatmap.vue'
import TopConductors from './TopConductors.vue'
import HuntAlertsModal from './HuntAlertsModal.vue'

// Loaded and kept fresh by the store, which the side menu also reads
const trainsStore = useHuntTrainsStore()
const { data, labels, loading, error, now, parsed, trains, sRanks } = storeToRefs(trainsStore)
const { load } = trainsStore

watch(error, (err) => err && message.error(err))

// Which trains ring the bell in the header; also editable from there
const alertsOpen = ref(false)

const unparsed = computed(() => parsed.value.filter((t) => !t).length)
const last = computed(() => lastTrains(trains.value))
// Which DCs and expansions each side's cards show (the charts always show everything), remembered per browser
const DC_OPTIONS = DATA_CENTERS.map((dc) => ({ value: dc.name, label: dc.name }))
const A_FILTERS: FilterGroup[] = [
  { key: 'dc', label: 'Data center', options: DC_OPTIONS },
  { key: 'expansion', label: 'Expansion', options: TRAIN_TYPES.map((t) => ({ value: t.key, label: `${t.label} ${t.expansion}` })) },
]
const S_FILTERS: FilterGroup[] = [
  { key: 'dc', label: 'Data center', options: DC_OPTIONS },
  {
    key: 'expansion',
    label: 'Expansion',
    options: Object.entries(EXPANSIONS)
      .map(([key, e]) => ({ value: key, label: `${e.label} ${e.name}` }))
      .reverse(),
  },
]

const FILTERS_KEY = 'huntDashboardFilters'
const filters = ref<{ a: FilterValue; s: FilterValue }>(readFilters())
function readFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(FILTERS_KEY) ?? '{}')
    return { a: saved.a ?? {}, s: saved.s ?? {} }
  } catch {
    return { a: {}, s: {} }
  }
}
watch(
  filters,
  (value) => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(value))
    } catch {
      // Not remembered then; it still filters
    }
  },
  { deep: true },
)

// An empty group lets everything through; with expansions ticked, a train or S rank of unknown expansion is left out
const passes = (ticked: string[] | undefined, values: string[]) => !ticked?.length || values.some((v) => ticked.includes(v))
const shownTrains = computed(() => trains.value.filter((t) => passes(filters.value.a.dc, [t.dc]) && passes(filters.value.a.expansion, t.types)))
const shownSRanks = computed(() =>
  sRanks.value.filter((s) => passes(filters.value.s.dc, [s.dc]) && passes(filters.value.s.expansion, s.expansion ? [String(s.expansion)] : [])),
)

// What's up now, in the section headers; and when each one happened, for the per-hour charts
const activeTrainCount = computed(() => shownTrains.value.filter((t) => isActive(t, now.value)).length)
const sRankUpCount = computed(() => shownSRanks.value.filter((s) => isUp(s, now.value)).length)
const trainEvents = computed(() => trains.value.map((t) => ({ at: t.startsAt, dc: t.dc })))
const sRankEvents = computed(() => sRanks.value.map((s) => ({ at: s.spottedAt, dc: s.dc })))

const trackingSince = computed(() => data.value?.messages.at(-1)?.createdAt ?? null)

const unnamedTypes = computed(() => {
  const named = new Set(Object.values(labels.value).map(trainTypeOfLabel))
  return TRAIN_TYPES.filter((t) => !named.has(t.key))
})

// Fresh data on opening the page, unless a load is already on its way (the store starts one for its first watcher)
const stopWatching = trainsStore.watch()
if (!loading.value) load()
onBeforeUnmount(stopWatching)
</script>

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
      <a-col :span="24">
        <UpcomingTrains :trains="trains" :now="now" :labels="labels" />
      </a-col>
      <a-col :span="24">
        <TrainSparkline :trains="trains" :now="now" />
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
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { useHuntTrainsStore } from '@/stores/huntTrainsStore'
import { DATA_CENTERS, TRAIN_TYPES, lastTrains, trainTypeOfLabel } from './trains'
import TrainKpis from './TrainKpis.vue'
import TrainSparkline from './TrainSparkline.vue'
import UpcomingTrains from './UpcomingTrains.vue'
import NextTrainCard from './NextTrainCard.vue'
import LastTrainTable from './LastTrainTable.vue'
import TrainHeatmap from './TrainHeatmap.vue'
import TopConductors from './TopConductors.vue'

// Loaded and kept fresh by the store, which the side menu also reads
const trainsStore = useHuntTrainsStore()
const { data, labels, loading, error, now, parsed, trains } = storeToRefs(trainsStore)
const { load } = trainsStore

watch(error, (err) => err && message.error(err))

const unparsed = computed(() => parsed.value.filter((t) => !t).length)
const last = computed(() => lastTrains(trains.value))
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

<template>
  <a-input-search v-model:value="url" placeholder="Paste report code e.g. abc123XYZ" enter-button="Fetch"
    :loading="store.loading" @search="fetchReportInformation(reportURL)" />

  <div v-for="player in store.lastReportPlayers" :key="player.id" class="py-1">
    <player-card v-if="store.playerSmallSummary[player.id]" :player="player"
      :player-summary-data="store.playerSmallSummary[player.id]!" @select="handlePlayerSelect"></player-card>
  </div>
</template>


<script setup lang="ts">
import { computed, ref } from 'vue';
import { useFFLogsStore } from '@/stores/fflogsStore'
import PlayerCard from './PlayerCard.vue';
import { parseReportURL } from '@/stores/fflogsUtils';
import type { ReportURL, TableData, Actor } from '@/types/fflogs';

const emit = defineEmits<{
  (e: 'selected', player: Actor, code: string): void
}>()

const store = useFFLogsStore()
const url = ref('');
const reportURL = computed(() => parseReportURL(url.value))
const playerSummaries = ref<Record<number, TableData>>({})

function handlePlayerSelect(player: Actor) {
  emit('selected', player, reportURL.value.code)
}

async function fetchReportInformation(report: ReportURL) {
  await store.fetchPlayers(report.code, report.fightIDs)
  await store.fetchReport(report.code, report.fightIDs)
  playerSummaries.value = {}
  await Promise.all(
    store.lastReportPlayers.map(async (player) => {
      console.log(player)
      const data = await store.fetchPlayerSumary(report.code, report.fightIDs, player.id)
      console.log(data)

      store.curatePlayerSummary(player.id, data)

      if (data) playerSummaries.value[player.id] = data
    })
  )
}
</script>

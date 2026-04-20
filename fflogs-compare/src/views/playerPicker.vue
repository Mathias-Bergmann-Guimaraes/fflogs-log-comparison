<template>
  <a-input-search v-model:value="url" placeholder="Paste report code e.g. abc123XYZ" enter-button="Fetch"
    :loading="store.loading" @search="fetchReportInformation(reportURL)" />

  <div v-for="player in store.lastReportPlayers" :key="player.id" class="py-1">
    <player-card :player="player"></player-card>
  </div>
</template>


<script setup lang="ts">
import { computed, ref } from 'vue';
import { useFFLogsStore } from '@/stores/fflogsStore'
import PlayerCard from './PlayerCard.vue';
import { parseReportURL } from '@/stores/fflogsUtils';
import type { ReportURL } from '@/types/fflogs';

const store = useFFLogsStore()
const url = ref('');
const reportURL = computed(() => parseReportURL(url.value))

async function fetchReportInformation(report: ReportURL) {
  store.fetchPlayers(report.code, report.fightIDs)
  await store.fetchReport(report.code, report.fightIDs)
  store.fetchAllEvents(report.code, report?.fightIDs, store.reports[report.code]?.fights[0]?.startTime, store.reports[report.code]?.fights[0]?.endTime)
}

</script>

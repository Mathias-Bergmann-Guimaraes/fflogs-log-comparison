<template>
  <a-input-search v-model:value="url" placeholder="Paste report code e.g. abc123XYZ" enter-button="Fetch"
    :loading="store.loading" @search="fetchReportInformation(reportURL)" />






  <div class="flex content-start flex-wrap">

    <div v-for="player in store.lastReportPlayers" :key="player.id" class="p-1 w-1/2">
      <player-card v-if="store.playerSmallSummary[player.id]" :player-name="player.name"
        :player-sub-type="player.subType" :player-summary-data="store.playerSmallSummary[player.id]!"
        @select="handlePlayerSelect"></player-card>
    </div>
  </div>

</template>


<script setup lang="ts">
import { computed, ref } from 'vue';
import { useFFLogsStore } from '@/stores/fflogsStore'
import PlayerCard from './PlayerCard.vue';
import { parseReportURL } from '@/stores/fflogsUtils';
import type { ReportURL, TableData } from '@/types/fflogs';

const emit = defineEmits<{
  (e: 'selected', playerSubType: string, code: string): void
}>()

const store = useFFLogsStore()
const url = ref('');
const reportURL = computed(() => parseReportURL(url.value))
const playerSummaries = ref<Record<number, TableData>>({})

function handlePlayerSelect(playerSubType: string) {
  emit('selected', playerSubType, reportURL.value.code)
}

async function fetchReportInformation(report: ReportURL) {
  await store.fetchPlayers(report.code, report.fightIDs)
  const reportData = await store.fetchReport(report.code, report.fightIDs)

  const fightStartTime = reportData?.fights[0]?.startTime
  const fightEndTime = reportData?.fights[0]?.endTime
  if (!fightStartTime || !fightEndTime) {
    return
  }
  playerSummaries.value = {}
  await Promise.all(
    store.lastReportPlayers.map(async (player) => {
      const data = await store.fetchPlayerSumary(report.code, report.fightIDs, player.id, fightStartTime, fightEndTime)

      store.curatePlayerSummary(player.id, data)

      if (data) playerSummaries.value[player.id] = data
    })
  )
}
</script>

<template>
  <a-divider />
  <div v-for="player in topPlayers" :key="player.name">
    <PlayerCard v-if="playerSummaries[player.name]" :player-name="player.name" :player-sub-type="player.spec"
      :player-summary-data="playerSummaries[player.name]!" />
  </div>
</template>
<script setup lang="ts">
import type { PlayerSummary, TopPlayerDto } from '@/types/fflogs';
import PlayerCard from './PlayerCard.vue';
import { useFFLogsStore } from '@/stores/fflogsStore'
import { ref, watch } from 'vue';

const store = useFFLogsStore()

const playerSummaries = ref<Record<string, PlayerSummary | undefined>>({})

const props = defineProps<{
  topPlayers: TopPlayerDto[]
}>()

async function fetchReportInformation(player: TopPlayerDto) {
  const { report, spec } = player
  const [topPlayer, topPlayerReport] = await Promise.all([
    store.fetchPlayerDetails(report.code, [report.fightID]),
    store.fetchReport(report.code, [report.fightID]),
  ])


  const allPlayers = [...topPlayer.tanks, ...topPlayer.healers, ...topPlayer.dps]
  const topPlayerId = allPlayers.find((player) => player.type === spec)

  console.log({ topPlayerReport, topPlayer })

  const startTime = topPlayerReport?.fights[0]?.startTime
  const endTime = topPlayerReport?.fights[0]?.endTime

  if (!startTime || !endTime || !topPlayerId) return

  const data = await store.fetchPlayerSumary(report.code, [report.fightID], topPlayerId.id, startTime, endTime)
  console.log(store.curatePlayerSummary(topPlayerId.id, data));

  playerSummaries.value[player.name] = store.curatePlayerSummary(topPlayerId.id, data)
}

watch(
  () => props.topPlayers,
  (players) => {
    playerSummaries.value = {}
    players.forEach(fetchReportInformation)
  },
  { immediate: true }
)
</script>

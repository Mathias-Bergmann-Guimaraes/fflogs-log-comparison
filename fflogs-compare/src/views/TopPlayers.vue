<template>
  <a-divider />
  <div v-for="player in topPlayers" :key="player.name" class="p-1">
    <a-skeleton v-if="!playerSummaries[player.name]" active :paragraph="{ rows: 2 }" />
    <big-player-card
      v-else-if="isSelectedPlayer(player.name)"
      :player-name="player.name"
      :player-sub-type="player.spec"
      :player-summary-data="playerSummaries[player.name]!"
      :code="playerReportInfo[player.name]?.code ?? ''"
      :fight-i-d="playerReportInfo[player.name]?.fightID ?? 0"
      :player-i-d="playerReportInfo[player.name]?.playerID ?? 0"
      :start-time="playerReportInfo[player.name]?.startTime ?? 0"
      :end-time="playerReportInfo[player.name]?.endTime ?? 0"
      :phases="phases[player.name] ?? []"
    />
    <player-card
      v-else
      :player-i-d="playerID[player.name] ?? 0"
      :player-name="player.name"
      :player-sub-type="player.spec"
      :player-summary-data="playerSummaries[player.name]!"
      @select="openPlayerCard"
    />
  </div>
</template>
<script setup lang="ts">
import type { PhaseDto, PlayerSummary, TopPlayerDto } from '@/types/fflogs'
import PlayerCard from './PlayerCard.vue'
import { useFFLogsStore } from '@/stores/fflogsStore'
import { ref, watch } from 'vue'
import BigPlayerCard from './BigPlayerCard.vue'

const store = useFFLogsStore()

interface PlayerReportInfo {
  code: string
  fightID: number
  playerID: number
  startTime: number
  endTime: number
}

const playerSummaries = ref<Record<string, PlayerSummary | undefined>>({})
const playerReportInfo = ref<Record<string, PlayerReportInfo>>({})
const playerID = ref<Record<string, number>>({})
const selectedPlayer = ref<string>('')
const phases = ref<Record<string, PhaseDto[]>>({})
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

  playerID.value[player.name] = topPlayerId?.id ?? 0
  phases.value[player.name] = (topPlayerReport?.fights[0]?.phaseTransitions ?? []) as PhaseDto[]
  console.log({ topPlayerReport, topPlayer })

  const startTime = topPlayerReport?.fights[0]?.startTime
  const endTime = topPlayerReport?.fights[0]?.endTime

  if (!startTime || !endTime || !topPlayerId) return

  const data = await store.fetchPlayerSumary(report.code, [report.fightID], topPlayerId.id, startTime, endTime)

  playerSummaries.value[player.name] = store.curatePlayerSummary(topPlayerId.id, data)
  playerReportInfo.value[player.name] = {
    code: report.code,
    fightID: report.fightID,
    playerID: topPlayerId.id,
    startTime,
    endTime,
  }
}

function openPlayerCard(_: string, playerName: string) {
  selectedPlayer.value = playerName
}

function closePlayerCard() {
  selectedPlayer.value = ''
}

const isSelectedPlayer = (playerName: string): boolean => {
  if (!selectedPlayer.value || !playerSummaries.value[playerName] || !playerReportInfo.value[playerName]) {
    return false
  }
  return playerName === selectedPlayer.value
}

watch(
  () => props.topPlayers,
  (players) => {
    console.log(props.topPlayers)
    playerSummaries.value = {}
    playerReportInfo.value = {}
    players.forEach(fetchReportInformation)
  },
  { immediate: true },
)
</script>

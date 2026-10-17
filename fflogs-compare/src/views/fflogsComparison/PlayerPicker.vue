<template>
  <a-input-search
    v-model:value="url"
    placeholder="Paste report code e.g. abc123XYZ"
    enter-button="Fetch"
    :loading="store.loading"
    @search="fetchReportInformation(reportURL)"
    class="pb-2"
  />

  <div class="flex">
    <!-- Supports -->
    <div class="w-1/2">
      <!-- Tank -->
      <div v-for="player in playersDetails?.tanks" :key="player.id" class="p-1">
        <player-card
          v-if="playerSummaries[player.id]"
          :player-i-d="player.id"
          :player-name="player.name"
          :player-sub-type="player.type"
          :player-summary-data="playerSummaries[player.id]!"
          @select="handlePlayerSelect"
        />
      </div>
      <!-- Healer -->
      <div v-for="player in playersDetails?.healers" :key="player.id" class="p-1">
        <player-card
          v-if="playerSummaries[player.id]"
          :player-i-d="player.id"
          :player-name="player.name"
          :player-sub-type="player.type"
          :player-summary-data="playerSummaries[player.id]!"
          @select="handlePlayerSelect"
        />
      </div>
    </div>
    <!-- DPS -->
    <div class="flex flex-col w-1/2">
      <div v-for="player in playersDetails?.dps" :key="player.id" class="p-1">
        <player-card
          v-if="playerSummaries[player.id]"
          :player-i-d="player.id"
          :player-name="player.name"
          :player-sub-type="player.type"
          :player-summary-data="playerSummaries[player.id]!"
          @select="handlePlayerSelect"
        />
      </div>
    </div>
  </div>

  <div class="flex content-start flex-wrap">
    <div v-for="player in store.lastReportPlayers" :key="player.id" class="p-1 w-1/2">
      <player-card
        v-if="store.playerSmallSummary[player.id]"
        :player-i-d="player.id"
        :player-name="player.name"
        :player-sub-type="player.subType"
        :player-summary-data="store.playerSmallSummary[player.id]!"
        @select="handlePlayerSelect"
      ></player-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFFLogsStore } from '@/stores/fflogsStore'
import PlayerCard from './PlayerCard.vue'
import { parseReportURL } from '@/stores/fflogsUtils'
import { type PlayerSummary, type ReportPlayersRoles, type ReportURL } from '@/types/fflogs'

const emit = defineEmits<{
  (e: 'selected', playerSubType: string, code: string, playerID: number): void
}>()

const store = useFFLogsStore()
const url = ref('')
const reportURL = computed(() => parseReportURL(url.value))
const playersDetails = ref<ReportPlayersRoles>()
const playerSummaries = ref<Record<number, PlayerSummary | undefined>>({})

function handlePlayerSelect(playerSubType: string, _: string, playerID: number) {
  emit('selected', playerSubType, reportURL.value.code, playerID)
}

async function fetchReportInformation(report: ReportURL) {
  const [reportPlayers, reportData] = await Promise.all([
    store.fetchPlayerDetails(report.code, report.fightIDs),
    store.fetchReport(report.code, report.fightIDs),
  ])

  const allPlayers = [...reportPlayers.tanks, ...reportPlayers.healers, ...reportPlayers.dps]
  playersDetails.value = reportPlayers

  const fightStartTime = reportData?.fights[0]?.startTime
  const fightEndTime = reportData?.fights[0]?.endTime

  if (!fightStartTime || !fightEndTime || !reportPlayers) {
    return
  }
  playerSummaries.value = {}

  await Promise.all(
    allPlayers.map(async (player) => {
      const data = await store.fetchPlayerSumary(report.code, report.fightIDs, player.id, fightStartTime, fightEndTime)
      playerSummaries.value[player.id] = store.curatePlayerSummary(player.id, data)
    }),
  )
}
</script>

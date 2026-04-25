<template>
  <div style="padding: 2rem">
    <player-picker @selected="handleSelectedJob"></player-picker>

    <top-players v-if="isCompareJobSelected && selectedJobAndFight"
      :top-players="store.topPlayers[selectedJobAndFight] ?? []"></top-players>


    <div v-if="store.quota" style="margin-top: 1rem">
      <a-progress :percent="quotaPercent" :status="quotaStatus"
        :format="() => `${store.quota!.pointsSpentThisHour} / ${store.quota!.limitPerHour} pts`" />
      <span style="font-size: 0.8rem; color: #888">
        Resets in {{ resetMinutes }} min
      </span>
    </div>


    <a-alert v-if="store.error" type="error" :message="store.error" style="margin-top: 1rem" />

  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFFLogsStore } from '@/stores/fflogsStore'
import PlayerPicker from './PlayerPicker.vue'
import TopPlayers from './TopPlayers.vue'

const store = useFFLogsStore()
const isCompareJobSelected = ref<boolean>(false)
const selectedJobAndFight = ref<string>('')

const quotaPercent = computed(() => {
  if (!store.quota) return 0
  return Math.round((store.quota.pointsSpentThisHour / store.quota.limitPerHour) * 100)
})

const quotaStatus = computed(() => {
  if (quotaPercent.value >= 90) return 'exception'
  if (quotaPercent.value >= 70) return 'normal'
  return 'success'
})

const resetMinutes = computed(() => {
  if (!store.quota) return 0
  return Math.ceil(store.quota.pointsResetIn / 60)
})

async function handleSelectedJob(playerSubType: string, code: string) {
  const data = await store.fetchTopPlayers(playerSubType, code)

  if (data) {
    selectedJobAndFight.value = `${playerSubType}-${store.reports[code]?.fights[0]?.encounterID}`
    isCompareJobSelected.value = true
  }
}

</script>

<template>
  <a-card style="cursor: pointer" @click="emit('select', props.playerSubType, props.playerName, props.playerID)">
    <a-card-meta :title="playerName">
      <template #avatar>
        <a-avatar :src="jobIconPath"></a-avatar>
      </template>
    </a-card-meta>
    <div class="flex items-center justify-around w-full">
      <span>rdps {{ playerSummaryData.rDPS.toFixed(2) }}</span>
      <span>adps {{ playerSummaryData.aDPS.toFixed(2) }}</span>
      <span>Crit% {{ percentage(playerSummaryData.crit) }}</span>
      <span>DH% {{ percentage(playerSummaryData.directHit) }}</span>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import type { PlayerSummary } from '@/types/fflogs'
import { computed } from 'vue'

const props = defineProps<{
  //TODO: remove player and use actual information needed like name/ subtype (job)
  playerID: number
  playerName: string
  playerSubType: string
  playerSummaryData: PlayerSummary
}>()

const emit = defineEmits<{
  (e: 'select', playerSubType: string, playerName: string, playerID: number): void
}>()

function percentage(num: number): string {
  return (num * 100).toFixed(2) + '%'
}
const jobIconPath = computed(() => `/job/${props.playerSubType}.png`)
</script>

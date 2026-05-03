<template>
  <a-card @click="emit('select', props.playerSubType)">
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
    <a-tabs type="card">
      <a-tab-pane key="1" tab="P1">
        <div class="pt-2 flex justify-arround">
          <div class="flex-1 max-w-1/3">
            <div class="pb-1">
              <!-- GRAPH SUMMARY -->
              <a-card class="w-full h-60">GRPAH</a-card>
            </div>
            <div>
              <!-- more Details -->
              <a-card class="w-full h-60">Interesting Details like crit value ( damage gained by crit not percentage ) rdps gained </a-card>
            </div>
          </div>
          <div class="flex justify-between grow pl-2">
            <!-- ABILITY SUMMARY -->
            <div class="px-0.5 w-full max-h-full overflow-y-auto">
              <!-- ABILITY LIST -->
              <ability-list :abilitys="tableEntries" :combat-time="combatTime" />
            </div>
            <div class="px-0.5 w-full h-full">
              <!-- DISCREPENCY LIST -->
              <a-card class="h-full">discrepency list</a-card>
            </div>
          </div>
        </div>
      </a-tab-pane>
      <a-tab-pane key="2" tab="P2">Content of Tab Pane 2</a-tab-pane>
      <a-tab-pane key="3" tab="P3">Content of Tab Pane 3</a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<script setup lang="ts">
import type { PlayerSummary, TableEntry } from '@/types/fflogs'
import { computed, onMounted, ref } from 'vue'
import AbilityList from './bigPlayerView/abilityList.vue'
import { useFFLogsStore } from '@/stores/fflogsStore'

const store = useFFLogsStore()

const props = defineProps<{
  playerName: string
  playerSubType: string
  playerSummaryData: PlayerSummary
  code: string
  fightID: number
  playerID: number
  startTime: number
  endTime: number
}>()

const emit = defineEmits<{
  (e: 'select', playerSubType: string): void
}>()

const tableEntries = ref<TableEntry[]>([])
const combatTime = ref<number>(0)

onMounted(async () => {
  const data = await store.fetchPlayerSumary(props.code, [props.fightID], props.playerID, props.startTime, props.endTime)
  tableEntries.value = data?.entries ?? []

  if (!data?.damageDowntime && data?.combatTime) {
    combatTime.value = data?.combatTime
  }
  if (data?.combatTime && data?.damageDowntime) combatTime.value = data?.combatTime - data?.damageDowntime
})

function percentage(num: number): string {
  return (num * 100).toFixed(2) + '%'
}
const jobIconPath = computed(() => `/job/${props.playerSubType}.png`)
</script>

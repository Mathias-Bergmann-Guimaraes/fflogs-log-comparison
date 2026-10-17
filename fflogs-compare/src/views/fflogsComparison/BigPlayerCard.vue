<template>
  <a-card @click="emit('select', props.playerSubType)">
    <a-card-meta :title="playerName">
      <template #avatar>
        <a-avatar :src="jobIconPath"></a-avatar>
      </template>
    </a-card-meta>
    <a-space>
      <span>{{ playerID }}</span>
      <span>{{ code }}</span>
    </a-space>
    <div class="flex items-center justify-around w-full">
      <span>rdps {{ playerSummaryData.rDPS.toFixed(2) }}</span>
      <span>adps {{ playerSummaryData.aDPS.toFixed(2) }}</span>
      <span>Crit% {{ percentage(playerSummaryData.crit) }}</span>
      <span>DH% {{ percentage(playerSummaryData.directHit) }}</span>
    </div>
    <a-tabs type="card">
      <a-tab-pane v-for="phase in props.phases" :key="phase.id" :tab="`P ${phase.id}`">
        <div class="pt-2 flex justify-arround">
          <div class="flex-1 max-w-1/3">
            <div class="pb-1">
              <!-- GRAPH SUMMARY -->
              <phase-graph :data="graphData[phase.id] ?? []" :selectedPlayerData="selectedPlayerGraphData[phase.id] ?? []"></phase-graph>
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
              <ability-list
                :abilitys="selectedPlayerTableData[phase.id]?.entries ?? []"
                :combat-time="selectedPlayerCombatTime[phase.id] ?? 0"
                :top-player-abilities="topPlayerTableEntries[phase.id] ?? []"
                :top-player-combat-time="topPlayerCombatTime[phase.id] ?? 0"
              />
            </div>
            <div class="px-0.5 w-full h-full">
              <!-- DISCREPENCY LIST -->
              <a-card class="h-full">discrepency list</a-card>
            </div>
          </div>
        </div>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<script setup lang="ts">
import type { PhaseDto, PlayerSummary, TableData, TableEntry } from '@/types/fflogs'
import { computed, onMounted, ref } from 'vue'
import AbilityList from './bigPlayerView/abilityList.vue'
import { useFFLogsStore } from '@/stores/fflogsStore'
import PhaseGraph from './bigPlayerView/PhaseGraph.vue'

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
  phases: PhaseDto[]
}>()

const emit = defineEmits<{
  (e: 'select', playerSubType: string): void
}>()

const topPlayerTableEntries = ref<Record<number, TableEntry[]>>({})
const topPlayerCombatTime = ref<Record<number, number>>({})
const selectedPlayerTableData = ref<Record<number, TableData>>(store.selectedPlayerTableData ?? {})
const selectedPlayerCombatTime = ref<Record<number, number>>(store.selectedPlayerPhaseCombatTime ?? 0)

const graphData = ref<Record<number, number[]>>({})
const selectedPlayerGraphData = ref<Record<number, number[]>>(store.selectedPlayerGraphData ?? {})

async function setupAbilityList() {
  await Promise.all(
    props.phases.map(async (phase) => {
      const phaseID = phase.id
      const { startTime, endTime } = phasePeriod(phaseID)
      const data = await store.fetchPlayerSumary(props.code, [props.fightID], props.playerID, startTime ?? 0, endTime ?? 0)
      topPlayerTableEntries.value[phaseID] = data?.entries ?? []
      if (!data?.damageDowntime && data?.combatTime) {
        topPlayerCombatTime.value[phaseID] = data?.combatTime
      }
      if (data?.combatTime && data?.damageDowntime) topPlayerCombatTime.value[phaseID] = data?.combatTime - data?.damageDowntime
    }),
  )
}

async function setupPhaseGraph() {
  await Promise.all(
    props.phases.map(async (phase) => {
      const phaseID = phase.id
      const { startTime, endTime } = phasePeriod(phaseID)
      const data = await store.fetchPlayerGraph(props.code, [props.fightID], props.playerID, startTime, endTime)
      const totalGraph = data?.series.filter((graph) => graph.name === 'Total')[0]
      graphData.value[phaseID] = totalGraph?.data ?? []
    }),
  )
}

const phasePeriod = (phase: number) => {
  return {
    startTime: props.phases[phase - 1]?.startTime ?? 0,
    endTime: phase === props.phases.length ? props.endTime : (props.phases[phase]?.startTime ?? 0),
  }
}

onMounted(async () => {
  await setupAbilityList()
  await setupPhaseGraph()
})

function percentage(num: number): string {
  return (num * 100).toFixed(2) + '%'
}
const jobIconPath = computed(() => `/job/${props.playerSubType}.png`)
</script>

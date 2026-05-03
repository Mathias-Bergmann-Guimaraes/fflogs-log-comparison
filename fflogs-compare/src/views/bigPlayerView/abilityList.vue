<template>
  <div>
    <h1>Ability List</h1>
    <a-row v-for="ability in sortedAbilities" :key="ability.guid">
      <a-col :span="8" class="pr-2">{{ ability.name }}</a-col>
      <a-col :span="13">
        <a-progress
          class="max-w-[90%]"
          :percent="dpsPrecentage(toNum(ability.totalRDPS))"
          status="normal"
          :format="() => `${calcDps(toNum(ability.totalRDPS)).toFixed(2)}`"
        />
      </a-col>
      <a-col :span="1">{{ ability.hitCount }}</a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import type { TableEntry } from '@/types/fflogs'
import { toNum } from '@/types/typesUtils'
import { computed } from 'vue'
import { R } from 'vue-router/dist/index-BzEKChPW.js'

const props = defineProps<{
  abilitys: TableEntry[]
  combatTime: number
}>()

const sortedAbilities = computed(() => [...props.abilitys].sort((a, b) => toNum(b.totalRDPS) - toNum(a.totalRDPS)))
const topRDps = computed(() => {
  const top = sortedAbilities.value[0]
  if (!top) return 0
  return (toNum(top.totalRDPS) / props.combatTime) * 1000
})

function calcDps(rDPS: number): number {
  return (rDPS / props.combatTime) * 1000
}

function dpsPrecentage(rDPS: number) {
  // TODO: fix this equasion make it pretty
  return (calcDps(rDPS) / topRDps.value) * 100
}
</script>

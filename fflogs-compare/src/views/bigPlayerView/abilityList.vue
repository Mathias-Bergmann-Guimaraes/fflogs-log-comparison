<template>
  <div>
    <h1>Ability List</h1>
    <div v-for="ability in sortedTopPlayerAbilities" :key="ability.guid">
      <ability-list-entry-item
        v-if="getAbility(ability.guid)"
        :ability="getAbility(ability.guid)!"
        :combat-time="props.combatTime"
        :highest-rdps="toNum(sortedAbilities[0]?.totalRDPS ?? 0)"
        :top-player-abilities="ability"
        :top-player-combat-time="props.topPlayerCombatTime"
        :top-player-highest-dps="toNum(sortedTopPlayerAbilities[0]?.totalRDPS ?? 0)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HitDetail, TableEntry } from '@/types/fflogs'
import { toNum } from '@/types/typesUtils'
import { computed } from 'vue'
import AbilityListEntryItem from './AbilityListEntryItem.vue'

const props = defineProps<{
  abilitys: TableEntry[]
  combatTime: number

  topPlayerAbilities: TableEntry[]
  topPlayerCombatTime: number
}>()

const sortedAbilities = computed(() => [...props.abilitys].sort((a, b) => toNum(b.totalRDPS) - toNum(a.totalRDPS)))
const sortedTopPlayerAbilities = computed(() => [...props.topPlayerAbilities].sort((a, b) => toNum(b.totalRDPS) - toNum(a.totalRDPS)))
const topRDps = computed(() => {
  const top = sortedAbilities.value[0]
  if (!top) return 0
  return (toNum(top.totalRDPS) / props.combatTime) * 1000
})

function getAbility(guid: number) {
  return sortedAbilities.value.find((playerAbility) => playerAbility.guid === guid)
}

function calculateCritDifference(hitdetails: HitDetail[] | undefined, directHitDetails: HitDetail[] | undefined, totalDamage = 0, totalRDPS = 0) {
  if (totalDamage === 0) {
    return dpsPrecentage(totalRDPS)
  }
  if (!hitdetails || !hitdetails[0] || !directHitDetails) {
    return 0
  }
  const normalHit = hitdetails?.filter((hd) => hd.type === 'Hit')
  if (!normalHit || !normalHit[0]) {
    return 0
  }

  const normalHitAvg = normalHit[0].total / normalHit[0].count

  let totalDpsOverhead = 0
  hitdetails.forEach((hit) => {
    const baseDamage = normalHitAvg * hit.count
    totalDpsOverhead += hit.total - baseDamage
  })
  directHitDetails.forEach((hit) => {
    const baseDamage = normalHitAvg * hit.count
    totalDpsOverhead += hit.total - baseDamage
  })
  const relativeHitRateOverhead = 1 - totalDpsOverhead / totalDamage

  return relativeHitRateOverhead * dpsPrecentage(totalRDPS)
}

function calcDps(rDPS: number): number {
  return (rDPS / props.combatTime) * 1000
}

function calculateTotalHitCount(hitdetails: HitDetail[], directHitDetails: HitDetail[]) {
  return [...hitdetails, ...directHitDetails].reduce((sum, hit) => sum + hit.count, 0)
}

function dpsPrecentage(rDPS: number) {
  // TODO: fix this equasion make it pretty
  return (calcDps(rDPS) / topRDps.value) * 100
}
</script>

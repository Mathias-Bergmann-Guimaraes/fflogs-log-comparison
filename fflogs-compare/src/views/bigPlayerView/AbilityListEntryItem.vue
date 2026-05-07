<template>
  <a-row>
    <a-col :span="8" class="pr-2">{{ ability.name }}</a-col>
    <a-col :span="11">
      <VChart :option="option" style="height: 1rem" autoresize />
    </a-col>
    <a-col :span="4">
      <span class="pl-2">
        {{ adjustedTotalRdps.toFixed(2) }}
      </span>
    </a-col>
    <a-col :span="1">
      <span class="pl-2">
        {{ calculateTotalHitCount(ability.hitdetails, ability.multistrikedetails) }}
      </span>
    </a-col>
  </a-row>
</template>

<script setup lang="ts">
import type { HitDetail, TableEntry } from '@/types/fflogs'
import { computed } from 'vue'
import { toNum } from '@/types/typesUtils'
import type { EChartsOption } from 'echarts'

const props = defineProps<{
  ability: TableEntry
  combatTime: number
  highestRdps: number

  topPlayerAbilities: TableEntry
  topPlayerCombatTime: number
  topPlayerHighestDps: number
}>()

function calcDps(rDPS: number, combatTime: number): number {
  return (rDPS / combatTime) * 1000
}

const abilityBaseDamageRatio = computed(() => {
  if (props.ability.total === 0) {
    return 1
  }
  const normalHit = props.ability.hitdetails.find((hd) => hd.type === 'Hit')
  const critHit = props.ability.hitdetails.find((hd) => hd.type === 'Critical Hit')
  const directHit = props.ability.multistrikedetails.find((hd) => hd.type === 'Hit')
  const directCritHit = props.ability.multistrikedetails.find((hd) => hd.type === 'Critical Hit')

  if (!normalHit) {
    return 1
  }

  const normalHitAvg = normalHit.total / normalHit.count
  const critBaseDamage = critHit ? normalHitAvg * critHit.count : 0
  const directHitBaseDamage = directHit ? normalHitAvg * directHit.count : 0
  const directCritbaseDamage = directCritHit ? normalHitAvg * directCritHit.count : 0

  return (normalHit.total + critBaseDamage + directHitBaseDamage + directCritbaseDamage) / props.ability.total
})

const adjustedBaseRdps = computed(() => {
  return calcDps(toNum(props.ability.totalRDPS), props.combatTime) * abilityBaseDamageRatio.value
})
const adjustedCritRdps = computed(() => {
  return calcDps(toNum(props.ability.totalRDPS), props.combatTime) * (1 - abilityBaseDamageRatio.value)
})

const adjustedTotalRdps = computed(() => {
  return calcDps(toNum(props.ability.totalRDPS), props.combatTime)
})
const adjustedTopPlayerDPS = computed(() => {
  return calcDps(toNum(props.topPlayerAbilities?.totalRDPS ?? 0), props.topPlayerCombatTime)
})

const adjustedHighestRdps = computed(() => calcDps(props.highestRdps, props.combatTime))
const adjustedTopPlayerHighestRdps = computed(() => calcDps(props.topPlayerHighestDps, props.topPlayerCombatTime))
const overAllHighestRdps = computed(() =>
  adjustedHighestRdps.value > adjustedTopPlayerHighestRdps.value ? adjustedHighestRdps.value : adjustedTopPlayerHighestRdps.value,
)

console.log({
  name: props.ability.name,
  base: adjustedBaseRdps.value,
  crit: adjustedCritRdps.value,
  totalRDPS: adjustedTotalRdps.value,
  highestDps: overAllHighestRdps.value,
  adjustedTopPlayerHighestRdps,
  overAllHighestRdps,
  time: props.topPlayerCombatTime,
  h: props.topPlayerHighestDps,
})

const option = computed<EChartsOption>(() => ({
  xAxis: { type: 'value', show: false, max: overAllHighestRdps.value },
  yAxis: {
    type: 'category',
    data: ['Resolution'],
    show: false,
  },
  grid: { left: 0, right: 0, top: 0, bottom: 0 },
  series: [
    {
      type: 'bar',
      stack: 'overlay',
      barGap: '-100%',
      z: 1,
      data: [adjustedTopPlayerDPS.value],
      itemStyle: { color: '#ffffff', opacity: 0.1 },
    },
    {
      type: 'bar',
      stack: 'total',
      z: 2,
      data: [adjustedBaseRdps.value],
      itemStyle: { color: '#3b82f6' },
    },
    {
      type: 'bar',
      stack: 'total',
      z: 2,
      data: [adjustedCritRdps.value],
      itemStyle: { color: '#4caf6e' },
    },
    {
      type: 'scatter',
      z: 3,
      data: [],
      markLine: {
        symbol: 'none',
        silent: true,
        data: [{ xAxis: adjustedTopPlayerDPS.value }],
        lineStyle: { color: '#ffffff', width: 2, opacity: 0.6, type: 'solid' },
        label: { show: false },
      },
    },
  ],
}))

function calculateTotalHitCount(hitdetails: HitDetail[], directHitDetails: HitDetail[]) {
  return [...hitdetails, ...directHitDetails].reduce((sum, hit) => sum + hit.count, 0)
}
</script>

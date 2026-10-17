<template>
  <a-card>
    <VChart :option="option" style="height: 15rem" autoresize />
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'

const props = defineProps<{
  data: number[]
  selectedPlayerData: number[]
}>()

function kama(data: number[], period = 10, fastPeriod = 2, slowPeriod = 30): number[] {
  if (data.length === 0) return []
  const fastAlpha = 2 / (fastPeriod + 1)
  const slowAlpha = 2 / (slowPeriod + 1)
  const result: number[] = data.slice(0, period).map(Number)
  for (let i = period; i < data.length; i++) {
    const direction = Math.abs(data[i]! - data[i - period]!)
    let volatility = 0
    for (let j = i - period + 1; j <= i; j++) volatility += Math.abs(data[j]! - data[j - 1]!)
    const er = volatility === 0 ? 1 : direction / volatility
    const sc = Math.pow(er * (fastAlpha - slowAlpha) + slowAlpha, 2)
    result.push(result[i - 1]! + sc * (data[i]! - result[i - 1]!))
  }
  return result
}

const option = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  legend: {},
  grid: { top: 8, right: 8, bottom: 24, left: 50 },
  xAxis: { type: 'category', data: [], splitLine: { show: false } },
  yAxis: { type: 'value', splitLine: { show: false } },
  series: [
    {
      data: kama(props.selectedPlayerData, 1),
      type: 'line',
      smooth: 0.1,
      color: 'gray',
    },
    {
      data: kama(props.data, 1),
      type: 'line',
      smooth: 0.1,
    },
  ],
}))
</script>

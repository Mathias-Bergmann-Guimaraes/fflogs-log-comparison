<template>
  <a-tooltip :title="tooltip">
    <a-tag :color="look.color" class="me-0! cursor-default text-xs tabular-nums">{{ look.text }}</a-tag>
  </a-tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDuration, respawnWindow, type Respawn, type TrainTypeKey } from './trains'

const props = defineProps<{ respawn: Respawn; type: TrainTypeKey; now: number }>()

// The respawn window, as "3h" and "6h"
const hours = computed(() => {
  const { min, max } = respawnWindow(props.type)
  return { min: formatDuration(min), max: formatDuration(max) }
})

const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { timeStyle: 'short' })

const look = computed(() => {
  const r = props.respawn
  switch (r.phase) {
    case 'unseen':
      return { color: 'default', text: 'not seen' }
    case 'open':
      return { color: 'green', text: 'open' }
    case 'window':
      return { color: 'gold', text: `respawning ${Math.round(r.progress * 100)}%` }
    case 'cooldown':
      return { color: 'default', text: `opens in ${formatDuration(r.opensAt - props.now)}` }
    case 'running':
      return { color: 'processing', text: 'running' }
    default: // announced
      return { color: 'warning', text: 'announced' }
  }
})

const tooltip = computed(() => {
  const r = props.respawn
  switch (r.phase) {
    case 'unseen':
      return 'No train seen since tracking began, so everything should be up'
    case 'open':
      return `Over ${hours.value.max} since the last train ended: every A rank is up, a train can start anytime`
    case 'window':
      return `Some A ranks are back (respawn is ${hours.value.min} to ${hours.value.max}). All up by ${time(r.fullAt)}`
    case 'cooldown':
      return `Nothing has respawned yet. Earliest respawn ${time(r.opensAt)}, all up by ${time(r.fullAt)}`
    case 'running':
      return 'A train is running now'
    default: // announced
      return 'A train is announced and about to start'
  }
})
</script>

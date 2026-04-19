<template>
  <a-card>
    <template #avatar>
      <a-avatar src="https://ffxiv.gamerescape.com/w/images/5/52/Scholar_Icon_7.png"></a-avatar>
    </template>
    <span>{{ playerName }}</span>
  </a-card>
</template>

<script setup lang="ts">
import type { PlayerDetails } from '@/stores/fflogsDataType';
import { ref } from 'vue'


const props = defineProps<{
  player: PlayerDetails
}>()

const playerName = ref<String>(props.player.name)
</script>

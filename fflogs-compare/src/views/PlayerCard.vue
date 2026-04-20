<template>
  <a-card>
    <a-card-meta :title="playerName">
      <template #avatar>
        <a-avatar :src="jobIconPath"></a-avatar>
      </template>
    </a-card-meta>
    <div class="flex items-center justify-around w-full">
      <span>rdps</span>
      <span>adps</span>
      <span>Crit%</span>
      <span>DH%</span>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import type { PlayerDetails } from '@/stores/fflogsDataType';
import { computed, ref } from 'vue'

const props = defineProps<{
  player: PlayerDetails
}>()

const playerName = ref<String>(props.player.name)
const playerJob = ref<String>(props.player.subType)

const jobIconPath = computed(() => `/job/${playerJob.value}.png`)

</script>

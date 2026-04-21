<template>
  <PlayerCard></PlayerCard>
</template>
<script setup lang="ts">
import type { TopPlayerDto } from '@/types/fflogs';
import PlayerCard from './PlayerCard.vue';

const props = defineProps<{
  topPlayers: TopPlayerDto[]
}>()




</script>

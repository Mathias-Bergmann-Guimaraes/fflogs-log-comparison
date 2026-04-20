<template>
  <a-input-search v-model:value="url" placeholder="Paste report code e.g. abc123XYZ" enter-button="Fetch"
    :loading="store.loading" @search="store.fetchPlayers(reportURL.code, reportURL?.fightIDs)" />

  <div v-for="player in store.lastReportPlayers" :key="player.id" class="py-1">
    <player-card :player="player"></player-card>
  </div>
</template>


<script setup lang="ts">
import { computed, ref } from 'vue';
import { useFFLogsStore } from '@/stores/fflogsStore'
import PlayerCard from './PlayerCard.vue';
import { parseReportURL } from '@/stores/fflogsUtils';

const store = useFFLogsStore()
const url = ref('');
const reportURL = computed(() => parseReportURL(url.value))

</script>

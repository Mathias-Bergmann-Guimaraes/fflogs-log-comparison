<template>
  <div style="padding: 2rem">
    <!-- <a-input-search v-model:value="code" placeholder="Paste report code e.g. abc123XYZ" enter-button="Fetch"
      :loading="store.loading" @search="store.fetchReport(code)" /> -->
    <player-picker></player-picker>


    <div v-if="store.quota" style="margin-top: 1rem">
      <a-progress :percent="quotaPercent" :status="quotaStatus"
        :format="() => `${store.quota!.pointsSpentThisHour} / ${store.quota!.limitPerHour} pts`" />
      <span style="font-size: 0.8rem; color: #888">
        Resets in {{ resetMinutes }} min
      </span>
    </div>


    <a-alert v-if="store.error" type="error" :message="store.error" style="margin-top: 1rem" />

    <div v-if="report" style="margin-top: 1rem">
      <h2>{{ report.title }}</h2>
      <a-table :dataSource="report.fights" :columns="columns" row-key="id" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFFLogsStore } from '@/stores/fflogsStore'
import PlayerPicker from './playerPicker.vue'

const store = useFFLogsStore()
const code = ref('')

const report = computed(() => store.reports[code.value])

const quotaPercent = computed(() => {
  if (!store.quota) return 0
  return Math.round((store.quota.pointsSpentThisHour / store.quota.limitPerHour) * 100)
})

const quotaStatus = computed(() => {
  if (quotaPercent.value >= 90) return 'exception'
  if (quotaPercent.value >= 70) return 'normal'
  return 'success'
})

const resetMinutes = computed(() => {
  if (!store.quota) return 0
  return Math.ceil(store.quota.pointsResetIn / 60)
})

const columns = [
  { title: 'Fight', dataIndex: 'name', key: 'name' },
  { title: 'Kill', dataIndex: 'kill', key: 'kill' },
  { title: 'Difficulty', dataIndex: 'difficulty', key: 'difficulty' },
]
</script>

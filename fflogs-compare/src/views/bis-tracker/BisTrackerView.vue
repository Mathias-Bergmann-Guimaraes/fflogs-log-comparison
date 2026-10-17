<template>
  <div class="p-5">
    <a-collapse v-model:active-key="openRoles" ghost>
      <a-collapse-panel v-for="group in jobsByRole" :key="group.role">
        <template #header>
          <h2 class="text-lg font-semibold text-gray-100" style="margin: 0">{{ group.role }}</h2>
        </template>
        <div class="flex flex-wrap gap-3">
          <job-bis-card v-for="job in group.jobs" :key="job" :job="job" />
        </div>
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import JobBisCard from './JobBisCard.vue'
import { jobsByRole } from '@/constants/jobs'

// All roles start expanded
const openRoles = ref<string[]>(jobsByRole.map((group) => group.role))
</script>

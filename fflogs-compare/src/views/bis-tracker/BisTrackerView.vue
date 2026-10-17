<template>
  <div class="p-5">
    <a-alert v-if="loadError" type="error" :message="`Couldn't load your BiS progress: ${loadError}`" show-icon class="mb-4" />
    <a-spin v-else-if="bis.loading" class="block py-10" />
    <a-collapse v-else v-model:active-key="openRoles" ghost>
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
import { useBisStore } from '@/stores/bisStore'

// All roles start expanded
const openRoles = ref<string[]>(jobsByRole.map((group) => group.role))

const bis = useBisStore()
const loadError = ref<string | null>(null)

bis.load().catch((err) => {
  loadError.value = err instanceof Error ? err.message : String(err)
})
</script>

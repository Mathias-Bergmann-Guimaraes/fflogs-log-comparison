<template>
  <!-- Shared by the BiS Tracker pages (Dashboard, Gear sets in the side menu): loads the BiS progress once for both -->
  <div class="p-5">
    <a-alert v-if="loadError" type="error" :message="`Couldn't load your BiS progress: ${loadError}`" show-icon class="mb-4" />
    <a-spin v-else-if="bis.loading" class="block py-10" />
    <template v-else>
      <div class="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-3">
        <a-typography-title :level="4" class="m-0!">{{ route.meta.menuLabel }}</a-typography-title>
        <dashboard-layout-controls v-if="route.name === 'bisDashboard'" />
      </div>
      <router-view />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import DashboardLayoutControls from './dashboard/DashboardLayoutControls.vue'
import { useBisStore } from '@/stores/bisStore'
import { BIS_PAGE_KEY } from '@/router'

const route = useRoute()

// Remember which page was open, so the BiS Tracker entry reopens it (see the router)
watch(
  () => route.name,
  (name) => {
    try {
      localStorage.setItem(BIS_PAGE_KEY, String(name))
    } catch {
      // Not remembered; fine
    }
  },
  { immediate: true },
)

const bis = useBisStore()
const loadError = ref<string | null>(null)

bis.load().catch((err) => {
  loadError.value = err instanceof Error ? err.message : String(err)
})
</script>

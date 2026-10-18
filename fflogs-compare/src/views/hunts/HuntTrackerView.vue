<template>
  <!-- Shared by the Hunt Tracker pages (EU A-Rank, EU S-Rank, All notifications in the side menu) -->
  <div class="p-5">
    <a-typography-title :level="4" class="mb-4!">{{ route.meta.menuLabel }}</a-typography-title>
    <!-- Keyed so each page gets its own instance (and its own filters and timers) -->
    <router-view :key="String(route.name)" />
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { HUNT_PAGE_KEY } from '@/router'

const route = useRoute()

// Remember which page was open, so the Hunt Tracker entry reopens it (see the router)
watch(
  () => route.name,
  (name) => {
    try {
      localStorage.setItem(HUNT_PAGE_KEY, String(name))
    } catch {
      // Storage unavailable: the default page opens next time
    }
  },
  { immediate: true },
)
</script>

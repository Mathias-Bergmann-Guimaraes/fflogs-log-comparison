<template>
  <!-- Shared by the BiS Tracker pages (Dashboard, Gear sets in the side menu): loads the BiS progress once for both -->
  <div class="p-5">
    <a-alert v-if="loadError" type="error" :message="`Couldn't load your BiS progress: ${loadError}`" show-icon class="mb-4" />
    <a-spin v-else-if="bis.loading || !gearSetsLoaded" class="block py-10" />
    <template v-else>
      <div class="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-3">
        <a-typography-title :level="4" class="m-0!">{{ route.meta.menuLabel }}</a-typography-title>
        <a-space wrap>
          <a-button @click="importOpen = true">
            <template #icon><import-outlined /></template>
            Import from xivgear
          </a-button>
          <dashboard-layout-controls v-if="route.name === 'bisDashboard'" />
        </a-space>
      </div>
      <!-- Imports into the set open on the Gear sets page (the default one elsewhere) -->
      <import-bis-dialog :key="importSetId" v-model:open="importOpen" :set-id="importSetId" />
      <router-view />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ImportOutlined } from '@ant-design/icons-vue'
import DashboardLayoutControls from './dashboard/DashboardLayoutControls.vue'
import ImportBisDialog from './ImportBisDialog.vue'
import { useBisStore } from '@/stores/bisStore'
import { useGearSetsStore } from '@/stores/gearSetsStore'
import { BIS_PAGE_KEY } from '@/router'
import { activeGearSetId } from './activeGearSet'

const route = useRoute()
const importOpen = ref(false)

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
const gearSets = useGearSetsStore()
const loadError = ref<string | null>(null)
const gearSetsLoaded = ref(false)

Promise.all([bis.load(), gearSets.load().then(() => (gearSetsLoaded.value = true))]).catch((err) => {
  loadError.value = err instanceof Error ? err.message : String(err)
})

const importSetId = computed(() => activeGearSetId(route, gearSets.sets))
</script>

<template>
  <div class="p-5">
    <a-alert v-if="loadError" type="error" :message="`Couldn't load your BiS progress: ${loadError}`" show-icon class="mb-4" />
    <a-spin v-else-if="bis.loading" class="block py-10" />
    <a-tabs v-else v-model:active-key="tab">
      <template #rightExtra>
        <dashboard-layout-controls v-if="tab === 'dashboard'" />
      </template>
      <a-tab-pane key="dashboard">
        <template #tab><dashboard-outlined /> Dashboard</template>
        <bis-dashboard />
      </a-tab-pane>

      <a-tab-pane key="gear">
        <template #tab><appstore-outlined /> Gear sets</template>
        <!-- Overall summary: completion on the left, what's left to buy on the right -->
        <a-card size="small" class="mb-3" :body-style="{ padding: '14px 20px' }">
          <div class="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div class="flex items-center gap-3">
              <a-progress type="circle" :percent="progress.percent" :size="48" :stroke-width="9" />
              <div>
                <a-typography-text type="secondary" class="block text-xs">BiS progress</a-typography-text>
                <span class="text-lg font-semibold tabular-nums">{{ progress.acquired }} / {{ progress.total }}</span>
                <a-typography-text type="secondary" class="ml-1 text-xs">items</a-typography-text>
              </div>
            </div>

            <a-divider type="vertical" class="h-10! max-sm:hidden" />

            <a-tooltip v-for="m in materialDefs" :key="m.key" placement="bottom">
              <template #title>
                <div v-for="r in roleTotals" :key="r.role" class="flex justify-between gap-6 tabular-nums">
                  <span>{{ r.role }}</span>
                  <span>{{ r.materials[m.key].toLocaleString() }}</span>
                </div>
              </template>
              <div class="flex cursor-default items-center gap-3">
                <a-avatar :src="m.icon" shape="square" :size="40" class="bg-gray-800! p-1.5" />
                <div>
                  <a-typography-text type="secondary" class="block text-xs">{{ m.label }} needed</a-typography-text>
                  <span class="text-lg font-semibold tabular-nums" :class="total[m.key] === 0 ? 'text-green-400' : ''">
                    {{ total[m.key].toLocaleString() }}
                  </span>
                </div>
              </div>
            </a-tooltip>

            <a-divider type="vertical" class="h-10! max-sm:hidden" />

            <!-- One block for all floors, so the bar stays on one line -->
            <div>
              <a-typography-text type="secondary" class="mb-1 block text-xs">Raid books needed</a-typography-text>
              <div class="flex items-center gap-4">
                <a-tooltip v-for="f in raidFloors" :key="f.floor" placement="bottom">
                  <template #title>
                    <div class="mb-1 font-semibold">{{ f.label }} books ({{ f.bookCost }} per item)</div>
                    <div v-if="!f.slots.length">Weapons aren't tracked yet</div>
                    <div v-for="r in roleTotals" v-else :key="r.role" class="flex justify-between gap-6 tabular-nums">
                      <span>{{ r.role }}</span>
                      <span>{{ r.raid[f.floor] }}</span>
                    </div>
                  </template>
                  <span class="inline-flex cursor-default items-center gap-1.5">
                    <floor-book :floor="f.floor" :size="24" />
                    <span v-if="!f.slots.length" class="text-lg font-semibold text-gray-500">–</span>
                    <span v-else class="text-lg font-semibold tabular-nums" :class="totalRaid[f.floor] === 0 ? 'text-green-400' : ''">
                      {{ totalRaid[f.floor] }}
                    </span>
                  </span>
                </a-tooltip>
              </div>
            </div>

            <a-tooltip :title="linkedNote">
              <info-circle-outlined class="ml-auto text-gray-500" />
            </a-tooltip>
          </div>
        </a-card>

        <a-collapse v-model:active-key="openRoles" ghost>
          <!-- Divider between roles; inline because ghost collapse styles strip panel borders -->
          <a-collapse-panel
            v-for="(group, i) in jobsByRole"
            :key="group.role"
            :style="i < jobsByRole.length - 1 ? { borderBottom: '1px solid #303030', paddingBottom: '8px', marginBottom: '8px' } : undefined"
          >
            <!-- Counts sit right next to the role name (not in #extra, which pins them to the far edge) -->
            <template #header>
              <div class="flex flex-wrap items-center gap-x-6 gap-y-1">
                <h2 class="text-lg font-semibold text-gray-100" style="margin: 0">{{ group.role }}</h2>
                <role-summary :jobs="group.jobs" />
              </div>
            </template>
            <div class="flex flex-wrap gap-3">
              <job-bis-card v-for="job in group.jobs" :key="job" :job="job" />
            </div>
          </a-collapse-panel>
        </a-collapse>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AppstoreOutlined, DashboardOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
import { EquipmentStatus } from '@/types/EquipmentType'
import { bisSlots } from '@/constants/bisSlots'
import JobBisCard from './JobBisCard.vue'
import RoleSummary from './RoleSummary.vue'
import BisDashboard from './dashboard/BisDashboard.vue'
import DashboardLayoutControls from './dashboard/DashboardLayoutControls.vue'
import FloorBook from './FloorBook.vue'
import { raidFloors } from '@/constants/raidFloors'
import { jobsByRole } from '@/constants/jobs'
import { materialDefs } from '@/constants/materials'
import { useBisStore } from '@/stores/bisStore'

// Remember the last tab in this browser; storage can be unavailable, so never let it throw
const TAB_KEY = 'bis-tracker-tab'
const readTab = () => {
  try {
    return localStorage.getItem(TAB_KEY) === 'dashboard' ? 'dashboard' : 'gear'
  } catch {
    return 'gear'
  }
}
const tab = ref(readTab())
watch(tab, (value) => {
  try {
    localStorage.setItem(TAB_KEY, value)
  } catch {
    // Not remembered; fine
  }
})

// All roles start expanded
const openRoles = ref<string[]>(jobsByRole.map((group) => group.role))
const allJobs = jobsByRole.flatMap((group) => group.jobs)
const linkedNote =
  'Tome items need the tome piece plus a twine or glaze. Raid counts only include jobs you have changed at least one item on. Linked items are bought once, so they count once.'

const bis = useBisStore()
const total = computed(() => bis.materialsNeeded(allJobs))
const totalRaid = computed(() => bis.booksNeeded(allJobs))
const roleTotals = computed(() =>
  jobsByRole.map((group) => ({ role: group.role, materials: bis.materialsNeeded(group.jobs), raid: bis.booksNeeded(group.jobs) })),
)

// Every job's set counts in full here: it's how much of each set is done, not how much to buy
const progress = computed(() => {
  const total = allJobs.length * bisSlots.length
  const acquired = allJobs.reduce((sum, job) => sum + bisSlots.filter((_, i) => bis.statusOf(job, i) === EquipmentStatus.ACQUIRED).length, 0)
  return { acquired, total, percent: Math.round((acquired / total) * 100) }
})
const loadError = ref<string | null>(null)

bis.load().catch((err) => {
  loadError.value = err instanceof Error ? err.message : String(err)
})
</script>

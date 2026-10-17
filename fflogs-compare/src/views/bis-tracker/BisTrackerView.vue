<template>
  <div class="p-5">
    <a-alert v-if="loadError" type="error" :message="`Couldn't load your BiS progress: ${loadError}`" show-icon class="mb-4" />
    <a-spin v-else-if="bis.loading" class="block py-10" />
    <template v-else>
      <!-- Overall summary: completion on the left, what's left to buy on the right -->
      <a-card size="small" class="mx-4! mb-3" :body-style="{ padding: '14px 20px' }">
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

          <a-tooltip :title="linkedNote">
            <info-circle-outlined class="ml-auto text-gray-500" />
          </a-tooltip>
        </div>
      </a-card>

      <a-collapse v-model:active-key="openRoles" ghost>
        <a-collapse-panel v-for="group in jobsByRole" :key="group.role">
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import { EquipmentStatus } from '@/types/EquipmentType'
import { bisSlots } from '@/constants/bisSlots'
import JobBisCard from './JobBisCard.vue'
import RoleSummary from './RoleSummary.vue'
import { jobsByRole } from '@/constants/jobs'
import { materialDefs } from '@/constants/materials'
import { useBisStore } from '@/stores/bisStore'

// All roles start expanded
const openRoles = ref<string[]>(jobsByRole.map((group) => group.role))
const allJobs = jobsByRole.flatMap((group) => group.jobs)
const linkedNote = 'Tome items need the tome piece plus a twine or glaze. Linked items are bought once, so they count once.'

const bis = useBisStore()
const total = computed(() => bis.materialsNeeded(allJobs))
const roleTotals = computed(() => jobsByRole.map((group) => ({ role: group.role, materials: bis.materialsNeeded(group.jobs) })))

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

<template>
  <div ref="root">
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
          <!-- Wrapper carries the scroll target and the highlight when arriving from the dashboard (?job=) -->
          <div
            v-for="job in group.jobs"
            :id="`gear-set-${job}`"
            :key="job"
            class="scroll-m-4 rounded-lg transition-shadow duration-1000"
            :class="highlighted === job && 'shadow-[0_0_0_2px_#1677ff,0_0_18px_2px_rgba(22,119,255,0.45)]'"
          >
            <job-bis-card :job="job" />
          </div>
        </div>
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import { EquipmentStatus } from '@/types/EquipmentType'
import { bisSlots } from '@/constants/bisSlots'
import JobBisCard from './JobBisCard.vue'
import RoleSummary from './RoleSummary.vue'
import FloorBook from './FloorBook.vue'
import { raidFloors } from '@/constants/raidFloors'
import { jobsByRole } from '@/constants/jobs'
import { materialDefs } from '@/constants/materials'
import { useBisStore } from '@/stores/bisStore'

// All roles start expanded
const openRoles = ref<string[]>(jobsByRole.map((group) => group.role))
const allJobs = jobsByRole.flatMap((group) => group.jobs)
const linkedNote =
  'Tome items need the tome piece plus a twine or glaze. Raid counts only include jobs you have changed at least one item on. Linked items are bought once, so they count once.'

const bis = useBisStore()

// --- Arriving with ?job=: open its role, scroll its card into view and highlight it for a moment ---
const HIGHLIGHT_MS = 2000
const route = useRoute()
const router = useRouter()
const highlighted = ref<string | null>(null)
let highlightTimer: ReturnType<typeof setTimeout> | undefined

// The page keeps growing for a moment after it opens (icons loading, role panels expanding), which would
// leave a one-off scroll short of the card. So keep re-aiming at the card whenever the page's size changes,
// until it settles (SETTLE_MS) or the user scrolls themselves.
const SETTLE_MS = 1500
const root = ref<HTMLElement | null>(null)
let stopPinning: (() => void) | undefined

function pinToCard(job: string) {
  stopPinning?.()
  const card = document.getElementById(`gear-set-${job}`)
  if (!card || !root.value) return
  card.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // ResizeObserver also fires once when it starts watching; skip that so the smooth scroll isn't cut short
  let initial = true
  const observer = new ResizeObserver(() => {
    if (initial) return void (initial = false)
    card.scrollIntoView({ behavior: 'instant', block: 'center' })
  })
  observer.observe(root.value)
  const userScrolled = () => stopPinning?.()
  const events = ['wheel', 'touchmove', 'keydown', 'mousedown'] as const
  events.forEach((e) => window.addEventListener(e, userScrolled, { passive: true }))
  const timer = setTimeout(() => stopPinning?.(), SETTLE_MS)

  stopPinning = () => {
    observer.disconnect()
    events.forEach((e) => window.removeEventListener(e, userScrolled))
    clearTimeout(timer)
    stopPinning = undefined
  }
}

onBeforeUnmount(() => {
  stopPinning?.()
  clearTimeout(highlightTimer)
})

watch(
  () => route.query.job,
  async (job) => {
    if (typeof job !== 'string' || !allJobs.includes(job)) return
    const role = jobsByRole.find((group) => group.jobs.includes(job))!.role
    if (!openRoles.value.includes(role)) openRoles.value.push(role)
    // Drop the query so a refresh or going back doesn't highlight it again
    router.replace({ query: { ...route.query, job: undefined } })

    await nextTick()
    pinToCard(job)
    highlighted.value = job
    clearTimeout(highlightTimer)
    highlightTimer = setTimeout(() => (highlighted.value = null), HIGHLIGHT_MS)
  },
  { immediate: true },
)
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
</script>

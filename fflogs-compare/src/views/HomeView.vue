<template>
  <div class="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-14">
    <div class="flex w-full max-w-6xl min-w-0 flex-col gap-10">
      <!-- Hero: who's here and where to start -->
      <section class="flex flex-col items-center gap-5 text-center">
        <div class="flex max-w-full flex-wrap justify-center gap-1.5 opacity-80">
          <img v-for="job in jobs" :key="job" :src="`/job/${job}.png`" :alt="jobDisplayName(job)" :title="jobDisplayName(job)" class="size-7" />
        </div>
        <div class="min-w-0">
          <h1 class="mb-3 text-3xl font-bold text-gray-100 sm:text-5xl">
            <template v-if="auth.user">
              Welcome back, <span class="text-blue-400">{{ auth.user.username }}</span>
            </template>
            <template v-else>FFXIV Companion</template>
          </h1>
          <p class="mx-auto max-w-2xl text-base text-gray-400 sm:text-lg">
            Plan your best-in-slot gear{{ hasHunts ? ', follow hunt trains as they run' : '' }} and compare your FF Logs reports with the world's top
            players, all in one place.
          </p>
        </div>
        <div class="flex flex-wrap justify-center gap-3">
          <template v-if="auth.user">
            <a-button type="primary" size="large" @click="router.push({ name: 'bisTracker' })">
              <template #icon><skin-outlined /></template>
              Open BiS Tracker
            </a-button>
            <a-button size="large" @click="router.push({ name: 'compare' })">
              <template #icon><bar-chart-outlined /></template>
              Compare logs
            </a-button>
          </template>
          <template v-else>
            <a-button type="primary" size="large" @click="router.push({ name: 'login' })">
              <template #icon><login-outlined /></template>
              Log in or register
            </a-button>
            <a-button size="large" @click="router.push({ name: 'compare' })">
              <template #icon><bar-chart-outlined /></template>
              Compare logs, no account needed
            </a-button>
          </template>
        </div>
      </section>

      <!-- At a glance: live numbers from the trackers, for signed-in users -->
      <section v-if="auth.user">
        <h2 class="mb-3 text-sm font-semibold tracking-wide text-gray-400 uppercase">At a glance</h2>
        <a-row :gutter="[16, 16]">
          <a-col :xs="24" :md="12">
            <a-card size="small" hoverable class="h-full cursor-pointer" @click="router.push({ name: 'bisDashboard' })">
              <a-skeleton v-if="bisLoading" active :paragraph="{ rows: 2 }" />
              <div v-else-if="plan.trackedJobs.value.length" class="flex items-center gap-4">
                <a-progress type="circle" :percent="completion.percent" :size="72" :stroke-color="statusColors.acquired" />
                <div class="min-w-0">
                  <a-typography-text type="secondary" class="text-xs">BiS completion</a-typography-text>
                  <div class="text-2xl font-semibold tabular-nums">{{ completion.acquired }} / {{ completion.total }}</div>
                  <a-typography-text type="secondary" class="text-xs">
                    {{ plan.trackedJobs.value.length }} tracked {{ plan.trackedJobs.value.length === 1 ? 'job' : 'jobs' }}
                    <template v-if="plan.doneDate.value"> · done around {{ formatDate(plan.doneDate.value) }}</template>
                    <template v-else-if="completion.percent === 100"> · all done</template>
                  </a-typography-text>
                </div>
              </div>
              <div v-else class="flex items-center gap-4">
                <span class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-2xl text-blue-400">
                  <skin-outlined />
                </span>
                <div class="min-w-0">
                  <div class="font-semibold text-gray-100">No gear tracked yet</div>
                  <a-typography-text type="secondary" class="text-xs">Pick your jobs' BiS pieces to see your progress here.</a-typography-text>
                </div>
              </div>
            </a-card>
          </a-col>

          <a-col :xs="24" :md="12">
            <a-card size="small" class="h-full">
              <div class="flex items-center gap-4">
                <span class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-2xl text-blue-400">
                  <field-time-outlined />
                </span>
                <div class="min-w-0">
                  <a-typography-text type="secondary" class="text-xs">Weekly reset</a-typography-text>
                  <div class="text-2xl font-semibold tabular-nums">in {{ formatDuration(nextReset - now) }}</div>
                  <a-typography-text type="secondary" class="text-xs">{{ resetLabel }} · tomestone cap and raid loot refresh</a-typography-text>
                </div>
              </div>
            </a-card>
          </a-col>
        </a-row>
      </section>

      <!-- Every tool in the app, with shortcuts to its pages -->
      <section>
        <h2 class="mb-3 text-sm font-semibold tracking-wide text-gray-400 uppercase">Tools</h2>
        <a-row :gutter="[16, 16]">
          <a-col v-for="tool in tools" :key="tool.name" :xs="24" :md="12" :xl="tools.length > 2 ? 8 : 12">
            <a-card
              hoverable
              class="flex! h-full flex-col"
              :body-style="{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }"
              @click="open(tool.name)"
            >
              <div class="flex items-start gap-3">
                <span class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-xl text-blue-400">
                  <component :is="tool.icon" />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-base font-semibold text-gray-100">{{ tool.label }}</span>
                    <a-tag v-if="tool.locked" class="m-0!">
                      <template #icon><lock-outlined /></template>
                      Account
                    </a-tag>
                  </div>
                  <div class="text-sm text-gray-400">{{ tool.text }}</div>
                </div>
              </div>
              <div v-if="tool.pages.length" class="mt-auto flex flex-wrap gap-2">
                <a-button v-for="page in tool.pages" :key="page.name" size="small" @click.stop="open(page.name)">
                  <template v-if="page.icon" #icon><component :is="page.icon" /></template>
                  {{ page.label }}
                </a-button>
              </div>
            </a-card>
          </a-col>
        </a-row>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { BarChartOutlined, FieldTimeOutlined, LockOutlined, LoginOutlined, SkinOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/authStore'
import { useBisStore } from '@/stores/bisStore'
import { allJobs, formatDate, nextWeeklyReset, useBisPlan } from '@/composables/useBisPlan'
import { jobDisplayName } from '@/constants/jobs'
import { bisSlots } from '@/constants/bisSlots'
import { EquipmentStatus } from '@/types/EquipmentType'
import { statusColors } from '@/views/bis-tracker/dashboard/chartTheme'
import { formatDuration } from '@/views/hunts/dashboard/trains'

const router = useRouter()
const auth = useAuthStore()

const jobs = allJobs

// Hunts are only mentioned to accounts that have the Hunt Tracker; everyone else never hears of it
const hasHunts = computed(() => auth.hasFeature('hunts'))

// What each top-level menu entry is for; entries without one still get a card, just without the blurb
const descriptions = computed<Record<string, string>>(() => ({
  compare: 'Pick a player from an FF Logs report and see how they stack up against the top-ranked players of the same job and fight.',
  bisTracker: 'Plan gear sets per job, see what to buy each week and follow your relic and ultimate weapon progress.',
  hunts: 'Live EU A rank trains and S rank spawns, with respawn windows and alerts for the hunts you care about.',
  settings: hasHunts.value
    ? 'Tune the tomestone cap, hunt timings and the rest of the numbers the trackers use.'
    : 'Tune the tomestone cap and the rest of the numbers the trackers use.',
}))

type ToolPage = { name: string; label: string; icon?: Component }

// The same entries as the side menu (see HomeViewLayout), minus Home itself and features the account doesn't have
const tools = computed(() =>
  router
    .getRoutes()
    .filter((r) => r.meta.menuLabel && r.name !== 'home' && r.path.split('/').filter(Boolean).length === 1)
    .filter((r) => !r.meta.feature || auth.hasFeature(r.meta.feature))
    // Settings is in the user menu already, and means nothing signed out
    .filter((r) => r.name !== 'settings' || auth.user)
    .map((r) => ({
      name: String(r.name),
      label: r.meta.menuLabel!,
      icon: r.meta.menuIcon,
      text: descriptions.value[String(r.name)] ?? '',
      locked: !!r.meta.requiresAuth && !auth.user,
      pages: r.children
        .filter((child) => child.meta?.menuLabel && child.name)
        .map<ToolPage>((child) => ({ name: String(child.name), label: child.meta!.menuLabel!, icon: child.meta!.menuIcon })),
    })),
)

// Locked tools go through the login page, which comes back to them afterwards (the router guard does that)
function open(name: string) {
  router.push({ name })
}

// --- BiS progress (the default gear set, like the BiS dashboard) ---

const bis = useBisStore()
const plan = useBisPlan()
const bisLoading = ref(false)

watch(
  () => auth.user?.id,
  async (id) => {
    if (!id) return
    bisLoading.value = true
    try {
      await bis.load()
    } catch (err) {
      console.error("Couldn't load BiS progress", err)
    } finally {
      bisLoading.value = false
    }
  },
  { immediate: true },
)

const completion = computed(() => {
  const tracked = plan.trackedJobs.value
  const total = tracked.length * bisSlots.length
  const acquired = tracked.reduce((sum, job) => sum + bisSlots.filter((_, i) => bis.statusOf(job, i) === EquipmentStatus.ACQUIRED).length, 0)
  return { acquired, total, percent: total ? Math.round((acquired / total) * 100) : 0 }
})

// --- Weekly reset countdown ---

const now = ref(Date.now())
const nextReset = computed(() => nextWeeklyReset(new Date(now.value)).getTime())
const resetLabel = computed(() => new Intl.DateTimeFormat(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(nextReset.value))
const clock = setInterval(() => (now.value = Date.now()), 30_000)
onUnmounted(() => clearInterval(clock))
</script>

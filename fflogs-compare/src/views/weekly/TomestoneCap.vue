<template>
  <!-- This week's tomestones against the cap: the same number as the BiS dashboard's stock (stockStore) -->
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span class="flex items-baseline gap-1.5">
        <span class="text-2xl font-semibold tabular-nums">
          {{ earned.toLocaleString() }}
          <a-typography-text type="secondary" class="text-sm font-normal">/ {{ cap.toLocaleString() }}</a-typography-text>
        </span>
        <plugin-mark field="tomesEarnedThisWeek" :value="stock.tomesEarnedThisWeek" />
      </span>
      <a-tag v-if="capped" color="green" class="m-0!">Capped</a-tag>
      <a-typography-text v-else type="secondary" class="text-xs">{{ (cap - earned).toLocaleString() }} to go</a-typography-text>
    </div>
    <a-progress :percent="percent" :show-info="false" :stroke-color="capped ? DONE_COLOR : undefined" class="m-0!" />

    <!-- One line: a narrow input (no addon, so a set width is safe) and the quick-add buttons joined up -->
    <div class="flex items-center gap-2">
      <a-input-number
        size="small"
        :min="0"
        :max="cap"
        :precision="0"
        :controls="false"
        :value="earned"
        class="w-16! shrink-0"
        aria-label="Tomestones earned this week"
        @change="(value: number | string | null) => setEarned(Number(value ?? 0))"
      />
      <a-space-compact size="small">
        <a-button v-for="step in STEPS" :key="step" size="small" :disabled="capped" @click="setEarned(earned + step)">+{{ step }}</a-button>
        <a-button size="small" :disabled="capped" @click="setEarned(cap)">Max</a-button>
      </a-space-compact>
    </div>

    <span class="flex flex-wrap items-center gap-1 text-xs">
      <a-typography-text type="secondary">
        <img :src="tomeIcon" alt="" class="mr-1 inline size-4 align-text-bottom" />{{ stock.tomes.toLocaleString() }} /
        {{ MAX_TOMES_HELD.toLocaleString() }} held · kept in this browser
      </a-typography-text>
      <plugin-mark field="tomes" :value="stock.tomes" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import tomeIcon from '@/assets/Allagan_Tomestone_of_Mnemonics.png'
import { MAX_TOMES_HELD } from '@/constants/tomeCosts'
import type { WeeklyActivity } from '@/constants/weeklyActivities'
import { useSettingsStore } from '@/stores/settingsStore'
import { useStockStore } from '@/stores/stockStore'
import { useWeeklyStore } from '@/stores/weeklyStore'
import PluginMark from '@/views/PluginMark.vue'

const props = defineProps<{ activity: WeeklyActivity }>()

const DONE_COLOR = '#49aa19'
const STEPS = [10, 50, 100]

const weekly = useWeeklyStore()
const settings = useSettingsStore()
const { stock } = storeToRefs(useStockStore())

const cap = computed(() => settings.weeklyTomeCap)
const earned = computed(() => Math.min(stock.value.tomesEarnedThisWeek, cap.value))
const capped = computed(() => earned.value >= cap.value)
const percent = computed(() => Math.round((earned.value / cap.value) * 100))

// Earning (or taking back) tomestones changes what's held too, which can't go past MAX_TOMES_HELD
function setEarned(value: number) {
  const next = Math.min(Math.max(0, Math.round(value)), cap.value)
  const held = stock.value.tomes + next - stock.value.tomesEarnedThisWeek
  stock.value.tomesEarnedThisWeek = next
  stock.value.tomes = Math.min(Math.max(0, held), MAX_TOMES_HELD)
}

// Reaching the cap ticks the activity (and dropping under it unticks it);
// ticking it from the card's header fills the bar
watch(capped, (value) => {
  if (weekly.isDone(props.activity) !== value) weekly.setDone(props.activity, value ? 1 : 0)
})
watch(
  () => weekly.isDone(props.activity),
  (done) => {
    if (done && !capped.value) setEarned(cap.value)
  },
)
</script>

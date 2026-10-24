<template>
  <!-- This week's checklist (weeklyStore): everything clears at the weekly reset -->
  <div class="p-5">
    <a-typography-title :level="4" class="mb-4!">Weekly</a-typography-title>

    <a-card size="small" class="mb-4!" :body-style="{ padding: '14px 20px' }">
      <div class="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div class="flex items-center gap-3">
          <a-progress type="circle" :percent="weekly.summary.percent" :size="48" :stroke-width="9" />
          <div>
            <a-typography-text type="secondary" class="block text-xs">Done this week</a-typography-text>
            <span class="text-lg font-semibold tabular-nums">{{ weekly.summary.done }} / {{ weekly.summary.total }}</span>
          </div>
        </div>
        <a-divider type="vertical" class="h-10! max-sm:hidden" />
        <div>
          <a-typography-text type="secondary" class="block text-xs">Weekly reset</a-typography-text>
          <span class="text-lg font-semibold tabular-nums">in {{ formatDuration(weekly.resetsAt - weekly.now) }}</span>
          <a-typography-text type="secondary" class="ml-2 text-xs">{{ resetLabel }}</a-typography-text>
        </div>
        <div class="ml-auto flex flex-wrap items-center gap-2">
          <label v-if="weekly.hiddenCount" class="flex items-center gap-2">
            <a-switch v-model:checked="showHidden" size="small" />
            <a-typography-text type="secondary">Show hidden ({{ weekly.hiddenCount }})</a-typography-text>
          </label>
          <a-popconfirm title="Untick everything for this week?" @confirm="weekly.resetWeek()">
            <a-button size="small">
              <template #icon><undo-outlined /></template>
              Clear week
            </a-button>
          </a-popconfirm>
        </div>
      </div>
    </a-card>

    <!-- A heading per category, then a card per activity (or per few similar ones) -->
    <section v-for="group in groups" :key="group.key" class="mb-6">
      <a-typography-title :level="5" class="mb-3!">{{ group.title }}</a-typography-title>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <a-card
          v-for="card in group.cards"
          :key="card.key"
          size="small"
          class="h-full"
          :style="cardDone(card) ? { borderColor: DONE_COLOR } : undefined"
        >
          <template #title>
            <span class="flex min-w-0 items-center gap-2">
              <check-circle-filled :style="{ color: cardDone(card) ? DONE_COLOR : '#555' }" />
              <span class="truncate">{{ card.title ?? card.activities[0]!.name }}</span>
            </span>
          </template>
          <!-- A card of its own: its hide button sits in the header -->
          <template v-if="!card.title" #extra>
            <hide-button :activity="card.activities[0]!" />
          </template>

          <div class="flex flex-col gap-3">
            <div
              v-for="activity in card.activities"
              :key="activity.id"
              class="flex flex-col gap-2"
              :class="weekly.isHidden(activity.id) && 'opacity-50'"
            >
              <div v-if="card.title" class="flex items-center justify-between gap-2">
                <span class="truncate font-medium" :class="weekly.isDone(activity) && 'text-gray-500 line-through'">{{ activity.name }}</span>
                <hide-button :activity="activity" />
              </div>
              <a-typography-text type="secondary" class="text-xs">{{ activity.description }}</a-typography-text>
              <div class="flex flex-wrap items-center gap-2">
                <a-input-number
                  v-if="activity.count"
                  size="small"
                  :min="0"
                  :max="activity.count"
                  :precision="0"
                  :value="weekly.doneCount(activity.id)"
                  :addon-after="`/ ${activity.count} ${activity.countLabel ?? ''}`"
                  :aria-label="`${activity.name} done`"
                  @change="(value: number | string | null) => weekly.setDone(activity, Number(value ?? 0))"
                />
                <a-checkbox
                  v-else
                  :checked="weekly.isDone(activity)"
                  @change="(e: CheckboxChangeEvent) => weekly.setDone(activity, e.target.checked ? 1 : 0)"
                >
                  Done
                </a-checkbox>
                <a-button v-if="activity.link" size="small" :href="activity.link.url" target="_blank" rel="noopener noreferrer">
                  {{ activity.link.label }}
                  <export-outlined />
                </a-button>
              </div>
            </div>
          </div>
        </a-card>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CheckboxChangeEvent } from 'ant-design-vue/es/checkbox/interface'
import { CheckCircleFilled, ExportOutlined, UndoOutlined } from '@ant-design/icons-vue'
import { weeklyGroups, type WeeklyCard } from '@/constants/weeklyActivities'
import { useWeeklyStore } from '@/stores/weeklyStore'
import { formatDuration } from '@/views/hunts/dashboard/trains'
import HideButton from './HideButton.vue'

const DONE_COLOR = '#49aa19'

const weekly = useWeeklyStore()
const showHidden = ref(false)

// Hidden activities stay out unless asked for; a card (and a category) with nothing left to show goes too
const groups = computed(() =>
  weeklyGroups
    .map((group) => ({
      ...group,
      cards: group.cards
        .map((card) => ({ ...card, activities: card.activities.filter((a) => showHidden.value || !weekly.isHidden(a.id)) }))
        .filter((card) => card.activities.length),
    }))
    .filter((group) => group.cards.length),
)

// Done once everything on it that isn't hidden is done
function cardDone(card: WeeklyCard) {
  const shown = card.activities.filter((a) => !weekly.isHidden(a.id))
  return shown.length > 0 && shown.every(weekly.isDone)
}

const resetLabel = computed(() => new Intl.DateTimeFormat(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(weekly.resetsAt))
</script>

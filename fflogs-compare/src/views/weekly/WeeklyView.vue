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

    <!-- A heading per category, then a card per activity (or per few similar ones).
         Masonry: CSS columns, each card as tall as its content and never split, so there's no blank space under any -->
    <section v-for="group in groups" :key="group.key" class="mb-2">
      <a-typography-title :level="5" class="mb-3!">{{ group.title }}</a-typography-title>
      <div class="columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
        <a-card
          v-for="card in group.cards"
          :key="card.key"
          size="small"
          class="mb-4! break-inside-avoid"
          :style="cardDone(card) ? { borderColor: DONE_COLOR } : undefined"
        >
          <template #title>
            <span class="flex min-w-0 items-center gap-2">
              <!-- Ticks everything on the card (or clears it all if it's already done) -->
              <a-tooltip :title="cardDone(card) ? 'Mark not done' : 'Mark all done'">
                <a-button
                  size="small"
                  type="text"
                  class="shrink-0 hover:bg-transparent! active:bg-transparent!"
                  :aria-label="`${cardDone(card) ? 'Mark not done' : 'Mark done'}: ${card.title ?? card.activities[0]!.name}`"
                  @click="toggleCard(card)"
                >
                  <template #icon>
                    <check-circle-filled :style="{ color: cardDone(card) ? DONE_COLOR : '#555' }" />
                  </template>
                </a-button>
              </a-tooltip>
              <img :src="card.icon ?? card.activities[0]!.icon" alt="" class="block size-7 shrink-0 rounded" />
              <span class="truncate">{{ card.title ?? card.activities[0]!.name }}</span>
            </span>
          </template>
          <!-- A card of its own: its favorite and hide buttons sit in the header -->
          <template v-if="!card.title" #extra>
            <span class="flex items-center">
              <favorite-button :activity="card.activities[0]!" />
              <hide-button :activity="card.activities[0]!" />
            </span>
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
                <span class="flex shrink-0 items-center">
                  <favorite-button :activity="activity" />
                  <hide-button :activity="activity" />
                </span>
              </div>
              <a-typography-text type="secondary" class="text-xs">{{ activity.description }}</a-typography-text>
              <tomestone-cap v-if="activity.id === 'tomestones'" :activity="activity" />
              <masked-carnivale v-else-if="activity.id === 'carnivale'" :activity="activity" />
              <faux-hollows v-else-if="activity.id === 'fauxHollows'" :activity="activity" />
              <weekly-tiles v-else-if="activity.parts && activity.tiles" :activity="activity" />
              <weekly-parts v-else-if="activity.parts" :activity="activity" />
              <div v-else class="flex flex-wrap items-center gap-2">
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
              <fashion-report v-if="activity.id === 'fashionReport'" />
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
import { weeklyGroups, type WeeklyCard, type WeeklyGroup } from '@/constants/weeklyActivities'
import { useWeeklyStore } from '@/stores/weeklyStore'
import { formatDuration } from '@/views/hunts/dashboard/trains'
import FashionReport from './FashionReport.vue'
import FauxHollows from './FauxHollows.vue'
import FavoriteButton from './FavoriteButton.vue'
import HideButton from './HideButton.vue'
import MaskedCarnivale from './MaskedCarnivale.vue'
import TomestoneCap from './TomestoneCap.vue'
import WeeklyParts from './WeeklyParts.vue'
import WeeklyTiles from './WeeklyTiles.vue'

const DONE_COLOR = '#49aa19'

const weekly = useWeeklyStore()
const showHidden = ref(false)

// Favorites come first, a card each, and leave their usual category.
// Hidden activities stay out unless asked for; a card (and a category) with nothing left to show goes too
const groups = computed(() => {
  const favorites: WeeklyGroup = {
    key: 'favorites',
    title: 'Favorites',
    cards: weekly.favorites.map((activity) => ({ key: activity.id, activities: [activity] })),
  }
  const rest = weeklyGroups.map((group) => ({
    ...group,
    cards: group.cards.map((card) => ({ ...card, activities: card.activities.filter((a) => !weekly.isFavorite(a.id)) })),
  }))
  return [favorites, ...rest]
    .map((group) => ({
      ...group,
      cards: group.cards
        .map((card) => ({ ...card, activities: card.activities.filter((a) => showHidden.value || !weekly.isHidden(a.id)) }))
        .filter((card) => card.activities.length),
    }))
    .filter((group) => group.cards.length)
})

// Done once everything on it that isn't hidden is done
function cardDone(card: WeeklyCard) {
  const shown = shownActivities(card)
  return shown.length > 0 && shown.every(weekly.isDone)
}

const shownActivities = (card: WeeklyCard) => card.activities.filter((a) => !weekly.isHidden(a.id))

function toggleCard(card: WeeklyCard) {
  weekly.setAllDone(shownActivities(card), !cardDone(card))
}

const resetLabel = computed(() => new Intl.DateTimeFormat(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(weekly.resetsAt))
</script>

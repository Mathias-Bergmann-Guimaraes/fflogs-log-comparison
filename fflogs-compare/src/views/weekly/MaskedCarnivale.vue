<template>
  <!-- This week's targets as the game's log shows them: a star per rank, the stage, then its objectives -->
  <div class="flex flex-col gap-2">
    <weekly-parts :activity="activity">
      <template #part="{ part, done }">
        <star-filled class="shrink-0 text-lg" :style="{ color: STAR_COLORS[part.key as Rank], opacity: done ? 0.5 : 1 }" />
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="flex min-w-0 items-center gap-2">
            <span class="shrink-0 text-xs font-semibold text-gray-400">{{ part.tag }}</span>
            <span class="truncate text-sm font-medium" :class="done ? 'text-gray-500 line-through' : 'text-gray-100'">
              {{ stageLabel(week.targets[part.key as Rank].stage) }}
            </span>
          </span>
          <span v-if="week.targets[part.key as Rank].objectives.length" class="flex flex-wrap gap-1">
            <a-tooltip v-for="objective in week.targets[part.key as Rank].objectives" :key="objective" :title="CARNIVALE_OBJECTIVES[objective]">
              <a-tag class="m-0! text-[11px]!" :class="done && 'opacity-50'">{{ objective }}</a-tag>
            </a-tooltip>
          </span>
          <a-typography-text v-else type="secondary" class="text-xs">Just clear it</a-typography-text>
        </span>
      </template>
    </weekly-parts>
    <a-typography-text type="secondary" class="text-xs">Week {{ week.number }} of the 20-week rotation</a-typography-text>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { StarFilled } from '@ant-design/icons-vue'
import { CARNIVALE_OBJECTIVES, CARNIVALE_STAGES, carnivaleWeek, type CarnivaleWeek } from '@/constants/maskedCarnivale'
import type { WeeklyActivity } from '@/constants/weeklyActivities'
import { useWeeklyStore } from '@/stores/weeklyStore'
import WeeklyParts from './WeeklyParts.vue'

defineProps<{ activity: WeeklyActivity }>()

type Rank = keyof CarnivaleWeek

// The stars' colours in the game's log
const STAR_COLORS: Record<Rank, string> = { novice: '#3b9cff', moderate: '#f0f0f0', advanced: '#e8b84a' }

const weekly = useWeeklyStore()
const week = computed(() => carnivaleWeek(weekly.resetsAt))

const stageLabel = (stage: number) => `${String(stage).padStart(2, '0')}. ${CARNIVALE_STAGES[stage]}`
</script>

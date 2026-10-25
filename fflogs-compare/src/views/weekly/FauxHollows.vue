<template>
  <!-- A fox per board this week, lit once it's played; the boards fill in order, so clicking one sets the count to it -->
  <div class="flex flex-wrap items-center gap-3">
    <a-tooltip
      v-for="board in activity.count"
      :key="board"
      :title="played(board) ? `Board ${board} played: click to undo` : `Mark board ${board} played`"
    >
      <button
        type="button"
        class="relative cursor-pointer rounded-lg p-0.5 transition hover:ring-2 hover:ring-blue-500"
        :class="played(board) && 'ring-2 ring-[#49aa19]'"
        :aria-label="`Board ${board}`"
        :aria-pressed="played(board)"
        @click="weekly.setDone(activity, played(board) ? board - 1 : board)"
      >
        <img :src="foxIcon" alt="" class="block size-12 rounded-md transition" :class="!played(board) && 'opacity-40 grayscale'" />
        <check-circle-filled
          v-if="played(board)"
          class="absolute -right-1.5 -bottom-1.5 rounded-full bg-gray-900"
          :style="{ color: DONE_COLOR, fontSize: '18px' }"
        />
      </button>
    </a-tooltip>

    <a-button v-if="activity.link" size="small" :href="activity.link.url" target="_blank" rel="noopener noreferrer">
      {{ activity.link.label }}
      <export-outlined />
    </a-button>
  </div>
</template>

<script setup lang="ts">
import { CheckCircleFilled, ExportOutlined } from '@ant-design/icons-vue'
import foxIcon from '@/assets/weekly/faux-board.png'
import type { WeeklyActivity } from '@/constants/weeklyActivities'
import { useWeeklyStore } from '@/stores/weeklyStore'

const props = defineProps<{ activity: WeeklyActivity }>()

const DONE_COLOR = '#49aa19'

const weekly = useWeeklyStore()

const played = (board: number) => weekly.doneCount(props.activity.id) >= board
</script>

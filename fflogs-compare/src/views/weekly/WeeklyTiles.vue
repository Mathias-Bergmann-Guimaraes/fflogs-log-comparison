<template>
  <!-- An activity's parts as pictures (e.g. a raid's bosses), each lit on its own once it's done -->
  <div class="flex flex-wrap gap-3">
    <a-tooltip v-for="(part, index) in activity.parts" :key="part.key" :title="`${part.tag} · ${part.name}`">
      <button
        type="button"
        class="flex cursor-pointer flex-col items-center gap-1"
        :aria-label="`${part.tag}: ${part.name}`"
        :aria-pressed="weekly.isPartDone(activity, index)"
        @click="weekly.togglePart(activity, index)"
      >
        <span
          class="relative block rounded-lg p-0.5 transition hover:ring-2 hover:ring-blue-500"
          :class="weekly.isPartDone(activity, index) && 'ring-2 ring-[#49aa19]'"
        >
          <img
            :src="part.icon"
            alt=""
            class="block size-12 rounded-md bg-gray-800 object-cover transition"
            :class="!weekly.isPartDone(activity, index) && 'opacity-40 grayscale'"
          />
          <check-circle-filled
            v-if="weekly.isPartDone(activity, index)"
            class="absolute -right-1.5 -bottom-1.5 rounded-full bg-gray-900"
            :style="{ color: DONE_COLOR, fontSize: '18px' }"
          />
        </span>
        <span class="text-[11px] leading-none" :class="weekly.isPartDone(activity, index) ? 'text-gray-200' : 'text-gray-500'">{{ part.tag }}</span>
      </button>
    </a-tooltip>
  </div>
</template>

<script setup lang="ts">
import { CheckCircleFilled } from '@ant-design/icons-vue'
import type { WeeklyActivity } from '@/constants/weeklyActivities'
import { useWeeklyStore } from '@/stores/weeklyStore'

defineProps<{ activity: WeeklyActivity }>()

const DONE_COLOR = '#49aa19'

const weekly = useWeeklyStore()
</script>

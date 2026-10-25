<template>
  <!-- An activity made of parts (e.g. one elite mark bill per expansion): a tile each, clicked when it's done -->
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-3">
      <a-progress :percent="percent" :show-info="false" :stroke-color="allDone ? DONE_COLOR : undefined" class="m-0! min-w-0 flex-1" />
      <span class="shrink-0 text-sm tabular-nums">
        {{ done }} <a-typography-text type="secondary">/ {{ parts.length }}</a-typography-text>
      </span>
    </div>

    <!-- One list, a row per part: reward icon, name and version, where and what it pays, then its tick -->
    <div class="flex flex-col divide-y divide-gray-700/70 overflow-hidden rounded-md border border-gray-700">
      <button
        v-for="(part, index) in parts"
        :key="part.key"
        type="button"
        class="flex w-full min-w-0 cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors"
        :class="weekly.isPartDone(activity, index) ? 'bg-[#49aa19]/10 hover:bg-[#49aa19]/15' : 'bg-transparent hover:bg-gray-800'"
        :aria-pressed="weekly.isPartDone(activity, index)"
        :aria-label="`${part.name}${part.hint ? ` (${part.hint})` : ''}`"
        @click="weekly.togglePart(activity, index)"
      >
        <!-- Everything before the tick; MaskedCarnivale puts its own in -->
        <slot name="part" :part="part" :done="weekly.isPartDone(activity, index)">
          <span v-if="part.icon" class="flex size-9 shrink-0 items-center justify-center rounded-md bg-gray-800">
            <img :src="part.icon" alt="" class="size-7" :class="weekly.isPartDone(activity, index) && 'opacity-50'" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="flex min-w-0 items-center gap-2">
              <span
                class="truncate text-sm font-medium"
                :class="weekly.isPartDone(activity, index) ? 'text-gray-500 line-through' : 'text-gray-100'"
                >{{ part.name }}</span
              >
              <a-tag :color="part.color" class="m-0! shrink-0 px-1! text-[11px]! leading-4!">{{ part.tag }}</a-tag>
            </span>
            <span v-if="part.hint || part.reward" class="truncate text-xs text-gray-400">
              {{ [part.hint, part.reward].filter(Boolean).join(' · ') }}
            </span>
          </span>
        </slot>
        <check-circle-filled v-if="weekly.isPartDone(activity, index)" class="shrink-0" :style="{ color: DONE_COLOR, fontSize: '20px' }" />
        <span v-else class="size-5 shrink-0 rounded-full border-2 border-gray-600" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircleFilled } from '@ant-design/icons-vue'
import type { WeeklyActivity } from '@/constants/weeklyActivities'
import { useWeeklyStore } from '@/stores/weeklyStore'

const props = defineProps<{ activity: WeeklyActivity }>()

const DONE_COLOR = '#49aa19'

const weekly = useWeeklyStore()

const parts = computed(() => props.activity.parts ?? [])
const done = computed(() => weekly.partsDone(props.activity))
const allDone = computed(() => done.value === parts.value.length)
const percent = computed(() => Math.round((done.value / parts.value.length) * 100))
</script>

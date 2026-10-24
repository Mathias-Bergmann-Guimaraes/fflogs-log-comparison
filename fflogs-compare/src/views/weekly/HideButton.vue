<template>
  <!-- Hides an activity the user doesn't do, or brings it back -->
  <a-tooltip :title="hidden ? 'Show again' : 'Hide: I don’t do this'">
    <a-button size="small" type="text" :aria-label="`${hidden ? 'Show' : 'Hide'} ${activity.name}`" @click="weekly.setHidden(activity.id, !hidden)">
      <template #icon>
        <eye-outlined v-if="hidden" />
        <eye-invisible-outlined v-else />
      </template>
    </a-button>
  </a-tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons-vue'
import type { WeeklyActivity } from '@/constants/weeklyActivities'
import { useWeeklyStore } from '@/stores/weeklyStore'

const props = defineProps<{ activity: WeeklyActivity }>()

const weekly = useWeeklyStore()
const hidden = computed(() => weekly.isHidden(props.activity.id))
</script>

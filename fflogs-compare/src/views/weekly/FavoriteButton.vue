<template>
  <!-- Pins an activity to the Favorites category at the top, or takes it back out -->
  <a-tooltip :title="favorite ? 'Remove from favorites' : 'Add to favorites'">
    <a-button
      size="small"
      type="text"
      :aria-label="`${favorite ? 'Unfavorite' : 'Favorite'} ${activity.name}`"
      @click="weekly.setFavorite(activity.id, !favorite)"
    >
      <template #icon>
        <star-filled v-if="favorite" :style="{ color: '#fadb14' }" />
        <star-outlined v-else />
      </template>
    </a-button>
  </a-tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { StarFilled, StarOutlined } from '@ant-design/icons-vue'
import type { WeeklyActivity } from '@/constants/weeklyActivities'
import { useWeeklyStore } from '@/stores/weeklyStore'

const props = defineProps<{ activity: WeeklyActivity }>()

const weekly = useWeeklyStore()
const favorite = computed(() => weekly.isFavorite(props.activity.id))
</script>

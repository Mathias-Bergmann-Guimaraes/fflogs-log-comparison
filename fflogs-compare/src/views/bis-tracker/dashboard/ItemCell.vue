<template>
  <div class="flex items-center gap-3">
    <!-- Plain <img> at whole-number fractions of the source size: the game icons are raster, and
         odd scale factors (or a-avatar's border shaving 2px off) make them blurry. Item icons are 40px. -->
    <img :src="equipmentIcons[bisSlots[slotIndex]!]" alt="" class="size-10 shrink-0 rounded-md" />
    <div class="min-w-0">
      <div class="leading-tight">{{ bisSlotLabels[slotIndex] }}</div>
      <div class="mt-1 flex gap-1">
        <!-- Job icons are 76px: 19px is exactly a quarter -->
        <!-- Favorites get a gold ring -->
        <a-tooltip v-for="j in jobs" :key="j" :title="favorites.isFavorite(j) ? `${jobDisplayName(j)} (favorite)` : jobDisplayName(j)">
          <img
            :src="`/job/${j}.png`"
            :alt="jobDisplayName(j)"
            class="size-4.75 rounded-sm"
            :class="favorites.isFavorite(j) && 'ring-1 ring-amber-400'"
          />
        </a-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { equipmentIcons } from '@/constants/icons'
import { bisSlotLabels, bisSlots } from '@/constants/bisSlots'
import { jobDisplayName } from '@/constants/jobs'
import { useFavoritesStore } from '@/stores/favoritesStore'

defineProps<{ slotIndex: number; jobs: string[] }>()

const favorites = useFavoritesStore()
</script>

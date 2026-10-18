<template>
  <!-- The floor number badge stays: the books differ mostly by colour, which is hard to read at small sizes -->
  <a-badge v-if="badge" :count="floor" :number-style="badgeStyle" :offset="[-2, size - 4]">
    <a-avatar :src="def.icon" shape="square" :size="size" class="bg-transparent!" />
  </a-badge>
  <a-avatar v-else :src="def.icon" shape="square" :size="size" class="bg-transparent!" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { raidFloors, type RaidFloor } from '@/constants/raidFloors'

// badge: off where the floor is already spelled out nearby (e.g. in a tooltip)
const props = withDefaults(defineProps<{ floor: RaidFloor; size?: number; badge?: boolean }>(), { size: 20, badge: true })

const def = computed(() => raidFloors.find((f) => f.floor === props.floor)!)

const badgeStyle = computed(() => ({
  backgroundColor: '#262626',
  color: '#d9d9d9',
  boxShadow: '0 0 0 1px #434343',
  fontSize: `${Math.max(9, props.size * 0.4)}px`,
  height: `${Math.max(12, props.size * 0.55)}px`,
  minWidth: `${Math.max(12, props.size * 0.55)}px`,
  lineHeight: `${Math.max(12, props.size * 0.55)}px`,
  padding: '0 3px',
}))
</script>

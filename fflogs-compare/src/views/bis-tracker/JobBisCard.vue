<template>
  <div class="w-44 rounded-lg border border-gray-700 bg-gray-800/60 p-3">
    <div class="mb-3 flex items-center gap-2">
      <img :src="jobIconPath" :alt="jobDisplayName" class="size-6" />
      <span class="truncate font-semibold text-gray-100">{{ jobDisplayName }}</span>
      <span class="ml-auto text-xs tabular-nums" :class="acquiredCount === slots.length ? 'text-green-400' : 'text-gray-400'">
        {{ acquiredCount }}/{{ slots.length }}
      </span>
    </div>

    <!-- Fills column by column: armour on the left, accessories on the right, like the in-game character screen -->
    <div class="grid grid-flow-col grid-rows-5 justify-between gap-y-2.5">
      <equipment-slot v-for="(slot, i) in slots" :key="i" v-model:status="statuses[i]" :type="slot" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import EquipmentSlot from './EquipmentSlot.vue'
import { EquipmentStatus, EquipmentType } from '@/types/EquipmentType'

const props = defineProps<{
  job: string
}>()

const slots = [
  EquipmentType.HEAD,
  EquipmentType.BODY,
  EquipmentType.HANDS,
  EquipmentType.LEGS,
  EquipmentType.FEET,
  EquipmentType.EARRINGS,
  EquipmentType.NECKLACE,
  EquipmentType.BRACELETS,
  EquipmentType.RING,
  EquipmentType.RING,
]

// Indexed like `slots`, so the two rings track separately
const statuses = ref<EquipmentStatus[]>(slots.map(() => EquipmentStatus.RAID))
const acquiredCount = computed(() => statuses.value.filter((s) => s === EquipmentStatus.ACQUIRED).length)

const jobIconPath = computed(() => `/job/${props.job}.png`)

// 'DarkKnight' -> 'Dark Knight'
const jobDisplayName = computed(() => props.job.replace(/([a-z])([A-Z])/g, '$1 $2'))
</script>

<template>
  <a-dropdown :trigger="['click']">
    <button
      type="button"
      class="relative size-12 cursor-pointer rounded-md border-2 transition hover:brightness-125"
      :class="equipmentStatuses[status].className"
      :title="equipmentStatuses[status].label"
    >
      <img :src="equipmentImage" alt="" class="size-full rounded p-0.5" />
      <!-- Badge sits on the inner corner, so both columns mirror each other -->
      <span
        class="absolute -bottom-1.5 flex size-5 items-center justify-center rounded-full bg-gray-900 p-0.5"
        :class="isAccessory(type) ? '-left-1.5' : '-right-1.5'"
      >
        <check-icon v-if="status === EquipmentStatus.ACQUIRED" class="size-full" />
        <img v-else :src="equipmentStatusIcons[status]" :alt="equipmentStatuses[status].label" class="size-full" />
      </span>
    </button>

    <template #overlay>
      <a-menu :selected-keys="[status]" @click="onStatusClick">
        <a-menu-item v-for="option in statusOptionsFor(type)" :key="option">
          <div class="flex items-center gap-2">
            <check-icon v-if="option === EquipmentStatus.ACQUIRED" class="size-5" />
            <img v-else :src="equipmentStatusIcons[option]" alt="" class="size-5" />
            {{ equipmentStatuses[option].label }}
          </div>
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<script setup lang="ts">
import { EquipmentStatus, EquipmentType, isAccessory } from '@/types/EquipmentType'
import { equipmentIcons, equipmentStatusIcons } from '@/constants/icons'
import { equipmentStatuses, statusOptionsFor } from '@/constants/equipmentStatus'

import CheckIcon from './CheckIcon.vue'
import { computed } from 'vue'

const props = defineProps<{
  type: EquipmentType
}>()

const status = defineModel<EquipmentStatus>('status', { default: EquipmentStatus.RAID })

function onStatusClick({ key }: { key: string | number }) {
  status.value = key as EquipmentStatus
}

const equipmentImage = computed(() => equipmentIcons[props.type])
</script>

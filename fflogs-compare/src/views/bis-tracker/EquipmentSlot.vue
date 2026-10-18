<template>
  <a-dropdown :trigger="['click']">
    <!-- Tooltip inside the dropdown: hover shows status, click opens the menu -->
    <a-tooltip :title="title" :mouse-enter-delay="0.4">
      <button
        type="button"
        class="relative size-12 cursor-pointer rounded-md border-2 transition hover:brightness-125"
        :class="[equipmentStatuses[status].className, highlighted && 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-800']"
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
    </a-tooltip>

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
import { EquipmentStatus, EquipmentType, isAccessory, type GearSource } from '@/types/EquipmentType'
import { equipmentStatusIcons, gearPiece } from '@/constants/icons'
import { equipmentStatuses, statusOptionsFor } from '@/constants/equipmentStatus'

import CheckIcon from './CheckIcon.vue'
import { computed } from 'vue'
import { jobDisplayName } from '@/constants/jobs'

const props = defineProps<{
  job: string
  type: EquipmentType
  // Which piece to show; an acquired slot remembers it
  source: GearSource
  // Other jobs sharing this slot; changing it changes theirs too
  linkedJobs?: string[]
  // Ring shown while the pointer is over this item or a linked one
  highlighted?: boolean
}>()

const status = defineModel<EquipmentStatus>('status', { default: EquipmentStatus.RAID })

function onStatusClick({ key }: { key: string | number }) {
  status.value = key as EquipmentStatus
}

const piece = computed(() => gearPiece(props.job, props.type, props.source))
const equipmentImage = computed(() => piece.value.icon)

const title = computed(() => {
  const statusLabel = equipmentStatuses[status.value].label
  const label = piece.value.name ? `${statusLabel}: ${piece.value.name}` : statusLabel
  return props.linkedJobs?.length ? `${label} · linked with ${props.linkedJobs.map(jobDisplayName).join(', ')}` : label
})
</script>

<template>
  <a-dropdown :trigger="['click']">
    <!-- Tooltip inside the dropdown: hover shows status, click opens the menu -->
    <a-tooltip :title="title" :mouse-enter-delay="0.4">
      <!-- The weapon spans the card: its icon on the left, then the item's name and status -->
      <button
        type="button"
        class="relative cursor-pointer rounded-md border-2 transition hover:brightness-125"
        :class="[
          wide ? 'flex h-12 w-full items-center gap-2 pr-2' : 'size-12',
          equipmentStatuses[status].className,
          highlighted && 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-800',
        ]"
      >
        <img :src="piece.icon" alt="" class="rounded p-0.5" :class="wide ? 'aspect-square h-full' : 'size-full'" />
        <span v-if="wide" class="min-w-0 flex-1 text-left leading-snug">
          <span class="block truncate text-xs">{{ piece.name ?? 'Weapon' }}</span>
          <span class="flex items-center gap-1 text-xs text-gray-400">
            <check-icon v-if="status === EquipmentStatus.ACQUIRED" class="size-4" />
            <img v-else :src="equipmentStatusIcons[status]" alt="" class="size-4" />
            {{ equipmentStatuses[status].label }}
            <api-outlined v-if="plugMark" :style="{ color: plugMark.color }" role="img" :aria-label="plugMark.label" />
          </span>
        </span>
        <!-- Badge sits on the inner corner, so both columns mirror each other -->
        <span
          v-else
          class="absolute -bottom-1.5 flex size-5 items-center justify-center rounded-full bg-gray-900 p-0.5"
          :class="isAccessory(type) ? '-left-1.5' : '-right-1.5'"
        >
          <check-icon v-if="status === EquipmentStatus.ACQUIRED" class="size-full" />
          <img v-else :src="equipmentStatusIcons[status]" :alt="equipmentStatuses[status].label" class="size-full" />
        </span>
        <!-- The game plugin saw the character with it (or, gray, could check): the plug on the inner top corner
             (the status has the bottom one) -->
        <span
          v-if="!wide && plugMark"
          class="absolute -top-1.5 flex size-5 items-center justify-center rounded-full bg-gray-900 text-xs"
          :class="isAccessory(type) ? '-left-1.5' : '-right-1.5'"
        >
          <api-outlined :style="{ color: plugMark.color }" role="img" :aria-label="plugMark.label" />
        </span>
      </button>
    </a-tooltip>

    <template #overlay>
      <a-menu :selected-keys="[status, itemKey(itemId)]" @click="onMenuClick">
        <a-menu-item v-for="option in statusOptionsFor(type, ultimate)" :key="option">
          <div class="flex items-center gap-2">
            <check-icon v-if="option === EquipmentStatus.ACQUIRED" class="size-5" />
            <img v-else :src="equipmentStatusIcons[option]" alt="" class="size-5" />
            {{ equipmentStatuses[option].label }}
          </div>
        </a-menu-item>

        <!-- Custom sets only: which item the slot is after, from the set's item level range -->
        <template v-if="itemOptions">
          <a-menu-divider />
          <a-sub-menu key="items" title="Item">
            <a-menu-item :key="itemKey(undefined)">
              <a-typography-text type="secondary">Automatic ({{ equipmentStatuses[status].label }} piece)</a-typography-text>
            </a-menu-item>
            <a-menu-item v-if="!itemOptions.length" key="none" disabled>Nothing found in this item level range</a-menu-item>
            <a-menu-item v-for="item in itemOptions" :key="itemKey(item.id)">
              <div class="flex items-center gap-2">
                <img :src="item.icon" alt="" class="size-6 rounded-sm" />
                {{ item.name }}
                <a-tag class="ml-auto! tabular-nums">i{{ item.ilvl }}</a-tag>
              </div>
            </a-menu-item>
          </a-sub-menu>
        </template>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<script setup lang="ts">
import { EquipmentStatus, EquipmentType, isAccessory } from '@/types/EquipmentType'
import { equipmentStatusIcons, type GearPiece } from '@/constants/icons'
import { equipmentStatuses, statusOptionsFor } from '@/constants/equipmentStatus'
import type { CatalogItem } from '@/stores/itemCatalogStore'

import CheckIcon from './CheckIcon.vue'
import { computed } from 'vue'
import { ApiOutlined } from '@ant-design/icons-vue'
import { jobDisplayName } from '@/constants/jobs'
import { PLUGIN_COLOR, PLUGIN_TRACKABLE_COLOR, PLUGIN_TRACKABLE_TEXT, usePluginStore } from '@/stores/pluginStore'
import { useSettingsStore } from '@/stores/settingsStore'

const props = defineProps<{
  type: EquipmentType
  // What the slot shows; an acquired slot remembers which piece it was
  piece: GearPiece
  // Other jobs sharing this slot; changing it changes theirs too
  linkedJobs?: string[]
  // Ring shown while the pointer is over this item or a linked one
  highlighted?: boolean
  // Items the slot can be pinned to (custom sets); no item menu without them
  itemOptions?: CatalogItem[]
  // The pinned item, if any
  itemId?: number
  // Weapon only: whether the tier has an ultimate, which makes it one of the options
  ultimate?: boolean
  // When the game plugin last saw the character with this item (bisStore.ownedAt); left out if it hasn't
  ownedAt?: number
  // Whether the slot's item is known, so the game plugin could check for it (the gray plug, when Settings asks for it)
  trackable?: boolean
}>()

const status = defineModel<EquipmentStatus>('status', { default: EquipmentStatus.RAID })
const emit = defineEmits<{ 'update:item': [itemId: number | null] }>()

const wide = computed(() => props.type === EquipmentType.WEAPON)

const itemKey = (id: number | undefined) => `item:${id ?? 'auto'}`

function onMenuClick({ key }: { key: string | number }) {
  const value = String(key)
  if (!value.startsWith('item:')) return void (status.value = value as EquipmentStatus)
  const id = value.slice('item:'.length)
  if (itemKey(props.itemId) !== value) emit('update:item', id === 'auto' ? null : Number(id))
}

const plugin = usePluginStore()
const settings = useSettingsStore()

// Cyan while the plugin saw the character with the item; gray where it could check but hasn't seen it, if Settings asks
const plugMark = computed(() => {
  if (props.ownedAt) return { color: PLUGIN_COLOR, label: 'You have it (game plugin)' }
  if (props.trackable && settings.showPluginTrackable) return { color: PLUGIN_TRACKABLE_COLOR, label: PLUGIN_TRACKABLE_TEXT }
  return undefined
})

const title = computed(() => {
  const statusLabel = equipmentStatuses[status.value].label
  const label = props.piece.name ? `${statusLabel}: ${props.piece.name}` : statusLabel
  const linked = props.linkedJobs?.length ? `${label} · linked with ${props.linkedJobs.map(jobDisplayName).join(', ')}` : label
  if (!props.ownedAt) return plugMark.value ? `${linked} · ${PLUGIN_TRACKABLE_TEXT}` : linked
  const when = new Date(props.ownedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  return `${linked} · You have it: the game plugin saw it${plugin.characterName ? ` on ${plugin.characterName}` : ''}, ${when}`
})
</script>

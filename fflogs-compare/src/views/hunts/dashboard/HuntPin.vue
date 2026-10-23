<template>
  <!-- The chips slide out to the left of the button, on the header's line -->
  <div ref="root" class="flex items-center gap-1">
    <div
      :class="[
        'flex items-center gap-2 overflow-hidden transition-[max-width,opacity] duration-200 ease-out',
        open ? 'max-w-96 opacity-100' : 'pointer-events-none max-w-0 opacity-0',
      ]"
      :aria-hidden="!open"
      :inert="!open"
    >
      <FilterChips :options="options" :picked="modelValue ? [modelValue] : []" single inline @toggle="toggle" />
      <span class="h-4 shrink-0 border-s border-white/10" />
    </div>

    <!-- The pinned expansion's tag, as on the cards, beside the button (inside it, Ant no longer centres the icon);
         hidden while the chips show it -->
    <a-tag v-if="pinnedOption && !open" :color="pinnedOption.color" :title="pinnedOption.title" class="me-0! cursor-pointer" @click="open = true">
      {{ pinnedOption.label }}
    </a-tag>

    <a-tooltip :title="open ? null : pinnedOption ? `${pinnedOption.title ?? pinnedOption.label} pinned first` : 'Pin an expansion first'">
      <a-button type="text" size="small" :aria-label="pinnedOption ? 'Pinned' : 'Pin'" :aria-expanded="open" class="shrink-0" @click="open = !open">
        <template #icon>
          <PushpinFilled v-if="pinnedOption" class="text-gray-200!" />
          <PushpinOutlined v-else class="text-gray-400!" />
        </template>
      </a-button>
    </a-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef } from 'vue'
import { PushpinFilled, PushpinOutlined } from '@ant-design/icons-vue'
import FilterChips, { type FilterOption } from './FilterChips.vue'

// One option at most; picking the pinned one again unpins it. The chips stay out after a pick.
const props = defineProps<{ options: FilterOption[]; modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

const open = ref(false)
const pinnedOption = computed(() => props.options.find((o) => o.value === props.modelValue))
const toggle = (value: string) => emit('update:modelValue', value === props.modelValue ? null : value)

// Closed by a click anywhere else or Escape
const root = useTemplateRef('root')
const onPointerDown = (e: PointerEvent) => open.value && !root.value?.contains(e.target as Node) && (open.value = false)
const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && (open.value = false)
document.addEventListener('pointerdown', onPointerDown)
document.addEventListener('keydown', onKeyDown)
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeyDown)
})
</script>

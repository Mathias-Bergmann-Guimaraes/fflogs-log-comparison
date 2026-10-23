<template>
  <a-popover v-model:open="open" trigger="click" placement="bottomRight" :overlay-style="{ width: '260px' }">
    <a-tooltip :title="active ? 'Filtered' : 'Filter'">
      <a-button type="text" size="small" :aria-label="active ? 'Filtered' : 'Filter'">
        <template #icon>
          <a-badge :dot="active" :offset="[-1, 1]">
            <FilterFilled v-if="active" class="text-gray-200!" />
            <FilterOutlined v-else class="text-gray-400!" />
          </a-badge>
        </template>
      </a-button>
    </a-tooltip>

    <template #title>
      <div class="flex items-center justify-between">
        <span>Show only</span>
        <a-button type="link" size="small" class="px-0!" :disabled="!active" @click="clear">Clear</a-button>
      </div>
    </template>

    <template #content>
      <div class="flex flex-col gap-3">
        <div v-for="group in groups" :key="group.key">
          <a-typography-text type="secondary" class="text-xs">{{ group.label }}</a-typography-text>
          <FilterChips :options="group.options" :picked="modelValue[group.key] ?? []" @toggle="(value) => toggle(group.key, value)" />
        </div>
        <a-typography-text type="secondary" class="text-xs">Nothing picked in a group shows all of it.</a-typography-text>
      </div>
    </template>
  </a-popover>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { FilterFilled, FilterOutlined } from '@ant-design/icons-vue'
import FilterChips, { type FilterOption } from './FilterChips.vue'

export type FilterGroup = { key: string; label: string; options: FilterOption[] }
// The picked values per group; an empty or missing group lets everything through
export type FilterValue = Record<string, string[]>

const props = defineProps<{ groups: FilterGroup[]; modelValue: FilterValue }>()
const emit = defineEmits<{ 'update:modelValue': [FilterValue] }>()

const open = ref(false)
const active = computed(() => Object.values(props.modelValue).some((values) => values.length))
const clear = () => emit('update:modelValue', {})

function toggle(group: string, value: string) {
  const picked = props.modelValue[group] ?? []
  emit('update:modelValue', { ...props.modelValue, [group]: picked.includes(value) ? picked.filter((v) => v !== value) : [...picked, value] })
}
</script>

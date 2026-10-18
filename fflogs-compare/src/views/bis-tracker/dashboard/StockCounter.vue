<template>
  <!-- [icon] 2 ±, or mirrored (± 2 [icon]) so a left column's icons can face the middle -->
  <div class="flex items-center gap-2" :class="reverse && 'flex-row-reverse'">
    <!-- The icon (40px); dimmed while the count is 0 -->
    <div class="shrink-0" :class="!count && 'opacity-40'">
      <slot />
    </div>
    <span class="w-5 text-center text-base tabular-nums" :class="!count && 'text-gray-500'">{{ count }}</span>
    <div class="flex flex-col">
      <a-button type="text" size="small" class="h-5! w-5! min-w-0! p-0!" :disabled="count >= max" :aria-label="`One more ${label}`" @click="count++">
        <template #icon><plus-circle-outlined /></template>
      </a-button>
      <a-button type="text" size="small" class="h-5! w-5! min-w-0! p-0!" :disabled="count <= 0" :aria-label="`One fewer ${label}`" @click="count--">
        <template #icon><minus-circle-outlined /></template>
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MinusCircleOutlined, PlusCircleOutlined } from '@ant-design/icons-vue'

// label: what one of these is, for the buttons' screen-reader text ('Head coffer')
withDefaults(defineProps<{ label: string; max?: number; reverse?: boolean }>(), { max: 99, reverse: false })

const count = defineModel<number>({ required: true })
</script>

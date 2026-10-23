<template>
  <!-- Chips to toggle: a picked one in its colour, the others dimmed. Inline, all on one line. -->
  <div :class="['flex gap-1.5', inline ? 'shrink-0 flex-nowrap items-center' : 'mt-1 flex-wrap']">
    <a-tag
      v-for="option in options"
      :key="option.value"
      :color="picked.includes(option.value) ? option.color : undefined"
      :style="[
        { '--wave-color': waveColor(option) },
        picked.includes(option.value) && option.dot ? { color: option.dot, borderColor: option.dot, background: `${option.dot}26` } : {},
      ]"
      :class="['me-0! cursor-pointer transition-opacity select-none', picked.includes(option.value) ? '' : 'opacity-50 hover:opacity-100']"
      :title="option.title"
      :role="single ? 'radio' : 'checkbox'"
      tabindex="0"
      :aria-checked="picked.includes(option.value)"
      @click="emit('toggle', option.value)"
      @keydown.enter.space.prevent="emit('toggle', option.value)"
    >
      <span v-if="option.dot" class="me-1.5 inline-block size-2 rounded-full" :style="{ background: option.dot }" />{{ option.label }}
    </a-tag>
  </div>
</template>

<script setup lang="ts">
import { theme } from 'ant-design-vue'

// Coloured like on the cards: color is an Ant preset (the expansions' tags), dot a hex colour (the data centers' dots).
// title: shown on hover (the expansion's name, when the chip only says its number)
export type FilterOption = { value: string; label: string; title?: string; color?: string; dot?: string }

// single: only one can be picked (the pin), for screen readers; inline: all on one line (the pin's slide-out)
defineProps<{ options: FilterOption[]; picked: string[]; single?: boolean; inline?: boolean }>()
const emit = defineEmits<{ toggle: [string] }>()

// Ant's click wave takes a chip's border colour, but an unpicked chip's is grey, so it would flash Ant's blue. The wave
// is drawn inside the chip and falls back to an inherited --wave-color, so each chip passes down its own.
const { token } = theme.useToken()
const waveColor = (option: FilterOption) =>
  option.dot ?? (option.color && (token.value as unknown as Record<string, string | undefined>)[option.color]) ?? undefined
</script>

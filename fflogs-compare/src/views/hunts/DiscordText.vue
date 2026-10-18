<template>
  <span class="wrap-break-word whitespace-pre-wrap">
    <template v-for="(seg, i) in segments" :key="i">
      <template v-if="seg.kind === 'text'">{{ seg.text }}</template>
      <strong v-else-if="seg.kind === 'bold'">{{ seg.text }}</strong>
      <a v-else-if="seg.kind === 'link'" :href="seg.url" target="_blank" rel="noopener noreferrer">{{ seg.url }}</a>
      <a-tag v-else-if="seg.kind === 'ping'" :color="pingColor(seg.ping)" class="me-0! cursor-pointer" @click="emit('ping', seg.ping)">
        @{{ pingLabel(seg.ping, labels).replace(/^@/, '') }}
      </a-tag>
      <a-typography-text v-else-if="seg.kind === 'mention'" type="secondary">{{ seg.text }}</a-typography-text>
      <img v-else-if="seg.kind === 'emoji'" :src="seg.url" :alt="`:${seg.name}:`" :title="`:${seg.name}:`" class="inline h-5 w-5 align-text-bottom" />
      <a-tooltip v-else-if="seg.kind === 'time'" :title="seg.title">
        <span class="rounded bg-white/10 px-1">{{ seg.text }}</span>
      </a-tooltip>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { HuntPing } from '@/types/hunts'
import { parseDiscordText, pingColor, pingLabel } from './discordText'

const props = defineProps<{ text: string; labels: Record<string, string> }>()
const emit = defineEmits<{ ping: [ping: HuntPing] }>()

const segments = computed(() => parseDiscordText(props.text))
</script>

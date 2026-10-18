<template>
  <div class="flex gap-3">
    <a-avatar :src="message.authorIcon ?? undefined" :size="40" class="shrink-0">{{ message.authorName.charAt(0) }}</a-avatar>
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-baseline gap-x-2">
        <!-- On the A-Rank page the role ping says which expansion the train is in, so it leads the message -->
        <template v-if="prominentPings">
          <a-tag
            v-for="ping in rolePings"
            :key="ping"
            :color="pingColor(ping)"
            class="me-0! cursor-pointer px-3! py-0.5! text-base! leading-6! font-semibold!"
            @click="emit('ping', ping)"
          >
            {{ pingLabel(ping, labels) }}
          </a-tag>
        </template>
        <span class="font-semibold">{{ message.authorName }}</span>
        <a-tag v-if="channelLabel" color="blue" class="me-0! cursor-pointer" @click="emit('channel', message.channelId!)">{{ channelLabel }}</a-tag>
        <a-tooltip :title="new Date(message.createdAt).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'medium' })">
          <a-typography-text type="secondary" class="text-xs">{{ relativeTime(message.createdAt, now) }}</a-typography-text>
        </a-tooltip>
        <a-typography-text v-if="message.editedAt" type="secondary" class="text-xs">(edited)</a-typography-text>
        <a-typography-text v-if="message.expiresAt" type="warning" class="text-xs">
          <ClockCircleOutlined /> hides {{ relativeTime(message.expiresAt, now) }}
        </a-typography-text>
      </div>

      <DiscordText v-if="message.content" :text="message.content" :labels="labels" @ping="emit('ping', $event)" />

      <!-- Embeds, with the colour bar Discord draws on the left -->
      <div
        v-for="(embed, i) in message.embeds"
        :key="i"
        class="mt-2 max-w-xl rounded border-l-4 bg-white/5 px-3 py-2"
        :style="{ borderLeftColor: embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#4e5058' }"
      >
        <div class="flex gap-3">
          <div class="min-w-0 flex-1">
            <a-typography-text v-if="embed.author" type="secondary" class="block text-xs">{{ embed.author }}</a-typography-text>
            <div v-if="embed.title" class="font-semibold">
              <a v-if="embed.url" :href="embed.url" target="_blank" rel="noopener noreferrer">{{ embed.title }}</a>
              <template v-else>{{ embed.title }}</template>
            </div>
            <DiscordText v-if="embed.description" :text="embed.description" :labels="labels" class="block text-sm" @ping="emit('ping', $event)" />
            <div v-if="embed.fields.length" class="mt-1 grid grid-cols-3 gap-x-4 gap-y-1">
              <div v-for="(field, j) in embed.fields" :key="j" :class="field.inline ? '' : 'col-span-3'">
                <div class="text-xs font-semibold">{{ field.name }}</div>
                <DiscordText :text="field.value" :labels="labels" class="text-sm" @ping="emit('ping', $event)" />
              </div>
            </div>
            <a-image v-if="embed.image" :src="embed.image" :width="300" class="mt-2 rounded" />
            <a-typography-text v-if="embed.footer" type="secondary" class="mt-1 block text-xs">{{ embed.footer }}</a-typography-text>
          </div>
          <a-image v-if="embed.thumbnail" :src="embed.thumbnail" :width="72" class="rounded" />
        </div>
      </div>

      <div v-if="message.attachments.length" class="mt-2 flex flex-wrap gap-2">
        <template v-for="file in message.attachments" :key="file.url">
          <a-image v-if="file.isImage" :src="file.url" :width="240" class="rounded" />
          <a v-else :href="file.url" target="_blank" rel="noopener noreferrer"><PaperClipOutlined /> {{ file.filename }}</a>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ClockCircleOutlined, PaperClipOutlined } from '@ant-design/icons-vue'
import type { HuntMessage, HuntPing } from '@/types/hunts'
import { computed } from 'vue'
import { pingColor, pingLabel, relativeTime } from './discordText'
import DiscordText from './DiscordText.vue'

const props = defineProps<{
  message: HuntMessage
  labels: Record<string, string>
  now: number
  channelLabel: string | null
  // Show the message's role pings as big badges in front of the author
  prominentPings?: boolean
}>()

const rolePings = computed(() => props.message.pings.filter((ping) => ping.startsWith('role:')))
const emit = defineEmits<{ ping: [ping: HuntPing]; channel: [id: string] }>()
</script>

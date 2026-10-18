<template>
  <div>
    <a-result
      v-if="meta && !meta.enabled"
      status="info"
      title="The hunt feed isn't set up"
      sub-title="Set HUNT_INGEST_SECRET (or DISCORD_BOT_TOKEN and DISCORD_HUNT_CHANNEL_ID) in the server's .env and restart it (see the README)."
    />

    <template v-else>
      <a-card size="small" class="mb-4!">
        <div class="flex flex-wrap items-center gap-3">
          <a-select
            v-if="channelOptions.length"
            v-model:value="selectedChannels"
            mode="multiple"
            allow-clear
            placeholder="All channels"
            :options="channelOptions"
            class="min-w-56"
          />
          <a-select
            v-model:value="selectedPings"
            mode="multiple"
            allow-clear
            placeholder="All pings"
            :options="pingOptions"
            :max-tag-count="4"
            class="min-w-72 flex-1 sm:max-w-xl"
          />
          <a-button :disabled="!rolePings.length" @click="openLabels"><template #icon><EditOutlined /></template>Name pings</a-button>
          <div class="flex-1" />
          <a-tooltip v-if="sync" :title="sync.at ? new Date(sync.at).toLocaleString() : undefined">
            <a-badge :status="sync.status" :text="sync.text" />
          </a-tooltip>
          <a-button :loading="loading" @click="refresh"><template #icon><ReloadOutlined /></template></a-button>
        </div>
      </a-card>

      <a-alert v-if="meta?.syncError" type="error" show-icon message="Couldn't read the Discord channel" :description="meta.syncError" class="mb-4!" />

      <a-card size="small">
        <a-list :data-source="messages" :loading="loading && !messages.length" item-layout="vertical" :locale="{ emptyText }">
          <template #renderItem="{ item }">
            <a-list-item :key="item.id">
              <HuntMessageItem
                :message="item"
                :labels="labels"
                :now="now"
                :channel-label="item.channelId ? channelLabel(item.channelId, item.channelName) : null"
                :prominent-pings="rank === 'A'"
                @ping="togglePing"
                @channel="toggleChannel"
              />
            </a-list-item>
          </template>
          <template #loadMore>
            <div v-if="hasMore" class="mt-3 text-center">
              <a-button :loading="loadingMore" @click="loadMore">Load older messages</a-button>
            </div>
          </template>
        </a-list>
      </a-card>
    </template>

    <a-modal v-model:open="labelsOpen" title="Name pings" ok-text="Save" :confirm-loading="savingLabels" @ok="saveLabels">
      <a-typography-paragraph type="secondary">
        The hunt server's roles only come through as numbers. Name them here so the filter and messages are readable. Click a ping
        in a message to filter on it if you're not sure which role is which.
      </a-typography-paragraph>
      <a-form layout="vertical">
        <a-form-item v-for="p in rolePings" :key="p.ping" :label="`${p.ping.slice(5)} · ${p.count} messages, last ${relativeTime(p.lastAt, now)}`">
          <a-input v-model:value="draftLabels[p.ping]" :placeholder="pingLabel(p.ping, {})" allow-clear />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { EditOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { apiFetch } from '@/api/backend'
import type { HuntMessage, HuntMeta, HuntPage, HuntPing, HuntRank } from '@/types/hunts'
import { fetchPingLabels, pingLabel, relativeTime } from './discordText'
import HuntMessageItem from './HuntMessageItem.vue'

// Unset on the All notifications page; the A / S rank pages only show that rank's channels
const props = defineProps<{ rank?: HuntRank }>()

// Matches the server's poll interval closely enough that new pings show up within a few seconds of syncing
const REFRESH_MS = 15_000
// Each page remembers its own filters
const FILTER_KEY = `hunts-ping-filter${props.rank ? `-${props.rank}` : ''}`
const CHANNEL_FILTER_KEY = `hunts-channel-filter${props.rank ? `-${props.rank}` : ''}`

const meta = ref<HuntMeta | null>(null)
const messages = ref<HuntMessage[]>([])
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const now = ref(Date.now())

function loadFilter(key: string): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(saved) ? saved.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}
const selectedPings = ref<HuntPing[]>(loadFilter(FILTER_KEY))
const selectedChannels = ref<string[]>(loadFilter(CHANNEL_FILTER_KEY))

// --- Ping names (per account, in the huntPingLabels setting) ---

const labels = ref<Record<string, string>>({})
const labelsOpen = ref(false)
const savingLabels = ref(false)
const draftLabels = ref<Record<string, string>>({})

async function loadLabels() {
  try {
    labels.value = await fetchPingLabels()
  } catch (err) {
    console.error("Couldn't load ping names", err)
  }
}

const rolePings = computed(() => meta.value?.pings.filter((p) => p.ping.startsWith('role:')) ?? [])

function openLabels() {
  draftLabels.value = { ...labels.value }
  labelsOpen.value = true
}

async function saveLabels() {
  const cleaned = Object.fromEntries(
    Object.entries(draftLabels.value)
      .map(([ping, label]) => [ping, label?.trim() ?? ''] as const)
      .filter(([, label]) => label),
  )
  savingLabels.value = true
  try {
    await apiFetch('/settings/huntPingLabels', { method: 'PUT', body: { value: cleaned } })
    labels.value = cleaned
    labelsOpen.value = false
  } catch (err) {
    message.error(err instanceof Error ? err.message : "Couldn't save ping names")
  } finally {
    savingLabels.value = false
  }
}

// --- Filter ---

const pingOptions = computed(() => {
  const options = (meta.value?.pings ?? []).map((p) => ({ value: p.ping, label: `${pingLabel(p.ping, labels.value)} (${p.count})` }))
  // A saved filter may name a ping that has no messages any more; keep it removable
  for (const ping of selectedPings.value) {
    if (!options.some((o) => o.value === ping)) options.push({ value: ping, label: pingLabel(ping, labels.value) })
  }
  return options
})

const channelLabel = (id: string, name: string | null | undefined) => (name ? `#${name}` : `#…${id.slice(-4)}`)

const channelOptions = computed(() => {
  const options = (meta.value?.channels ?? []).map((ch) => ({ value: ch.id, label: `${channelLabel(ch.id, ch.name)} (${ch.count})` }))
  for (const id of selectedChannels.value) {
    if (!options.some((o) => o.value === id)) options.push({ value: id, label: channelLabel(id, null) })
  }
  return options
})

function toggleChannel(id: string) {
  selectedChannels.value = selectedChannels.value.includes(id) ? selectedChannels.value.filter((c) => c !== id) : [...selectedChannels.value, id]
}

function togglePing(ping: HuntPing) {
  selectedPings.value = selectedPings.value.includes(ping) ? selectedPings.value.filter((p) => p !== ping) : [...selectedPings.value, ping]
}

const emptyText = computed(() => {
  if (selectedPings.value.length || selectedChannels.value.length) return 'No messages match these filters yet'
  if (meta.value && !meta.value.polling) return 'No messages received yet'
  return meta.value?.lastSyncAt ? 'No messages in the channel yet' : 'Waiting for the first sync…'
})

// Polling reports each sync; a pushing bot only shows up when it sends something
const sync = computed(() => {
  const m = meta.value
  if (!m) return null
  if (m.polling) {
    if (m.syncError) return { status: 'error', text: 'Sync failing', at: m.lastSyncAt } as const
    if (!m.lastSyncAt) return { status: 'processing', text: 'Syncing…', at: null } as const
    return { status: 'success', text: `Synced ${relativeTime(m.lastSyncAt, now.value)}`, at: m.lastSyncAt } as const
  }
  if (!m.lastPushAt) return { status: 'default', text: 'Waiting for the bot', at: null } as const
  return { status: 'success', text: `Last received ${relativeTime(m.lastPushAt, now.value)}`, at: m.lastPushAt } as const
})

// --- Loading ---

function pageUrl(cursor?: { before?: string; after?: string }) {
  const params = new URLSearchParams()
  if (cursor?.before) params.set('before', cursor.before)
  if (cursor?.after) params.set('after', cursor.after)
  for (const ping of selectedPings.value) params.append('ping', ping)
  for (const channel of selectedChannels.value) params.append('channel', channel)
  if (props.rank) params.set('rank', props.rank)
  const query = params.toString()
  return `/hunts${query ? `?${query}` : ''}`
}

// Bumped on every reload, so a slow response for an old filter can't overwrite a newer one
let generation = 0

async function loadFirst() {
  const gen = ++generation
  loading.value = true
  try {
    const page = await apiFetch<HuntPage>(pageUrl())
    if (gen !== generation) return
    messages.value = page.messages
    hasMore.value = page.hasMore
  } catch (err) {
    if (gen === generation) message.error(err instanceof Error ? err.message : "Couldn't load messages")
  } finally {
    if (gen === generation) loading.value = false
  }
}

async function loadMore() {
  const oldest = messages.value.at(-1)
  if (!oldest) return
  const gen = generation
  loadingMore.value = true
  try {
    const page = await apiFetch<HuntPage>(pageUrl({ before: oldest.id }))
    if (gen !== generation) return
    messages.value = [...messages.value, ...page.messages]
    hasMore.value = page.hasMore
  } catch (err) {
    message.error(err instanceof Error ? err.message : "Couldn't load messages")
  } finally {
    loadingMore.value = false
  }
}

// Prepends anything newer than the top message; if there's more than a page of it, starts over
async function loadNewer() {
  const newest = messages.value[0]
  if (!newest) return loadFirst()
  const gen = generation
  const page = await apiFetch<HuntPage>(pageUrl({ after: newest.id }))
  if (gen !== generation) return
  if (page.hasMore) return loadFirst()
  if (page.messages.length) messages.value = [...page.messages, ...messages.value]
}

async function loadMeta() {
  meta.value = await apiFetch<HuntMeta>(`/hunts/meta${props.rank ? `?rank=${props.rank}` : ''}`)
}

async function refresh() {
  try {
    await Promise.all([loadMeta(), loadNewer()])
  } catch (err) {
    console.error("Couldn't refresh hunts", err)
  }
  now.value = Date.now()
}

watch([selectedPings, selectedChannels], ([pings, channels]) => {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(pings))
    localStorage.setItem(CHANNEL_FILTER_KEY, JSON.stringify(channels))
  } catch {
    // Storage unavailable: the filters just aren't remembered
  }
  loadFirst()
})

loadLabels()
loadMeta().catch((err) => console.error("Couldn't load hunt meta", err))
loadFirst()

// Ticks faster than the refresh, so S rank messages vanish close to when they expire
function tick() {
  now.value = Date.now()
  if (messages.value.some((m) => m.expiresAt !== null && m.expiresAt <= now.value)) {
    messages.value = messages.value.filter((m) => m.expiresAt === null || m.expiresAt > now.value)
  }
}

const timers = [setInterval(refresh, REFRESH_MS), setInterval(tick, 5_000)]
onBeforeUnmount(() => timers.forEach(clearInterval))
</script>

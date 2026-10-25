<template>
  <!-- Tokens for the game plugin (server/plugin.ts) and what it has sent so far. Acts at once: not part of the Settings draft. -->
  <a-card size="small" title="Game plugin">
    <a-typography-paragraph type="secondary" class="text-xs">
      A game plugin sends your character's data here: give it this address and a token. Each token works until it's revoked; make one per computer so
      you can revoke them separately.
    </a-typography-paragraph>
    <a-typography-paragraph :copyable="{ text: ingestUrl }" class="mb-3!">
      <a-typography-text code>{{ ingestUrl }}</a-typography-text>
    </a-typography-paragraph>

    <a-table :columns="tokenColumns" :data-source="tokens" :loading="loading" :pagination="false" size="small" row-key="id" class="mb-3">
      <template #emptyText>No tokens yet</template>
      <template #bodyCell="{ column, record }">
        <span v-if="column.key === 'name'" class="block max-w-48 truncate">{{ record.name }}</span>
        <span v-else-if="column.key === 'createdAt'">{{ formatDate(record.createdAt) }}</span>
        <span v-else-if="column.key === 'lastUsedAt'">
          <template v-if="record.lastUsedAt">{{ formatDate(record.lastUsedAt) }}</template>
          <a-typography-text v-else type="secondary">Never</a-typography-text>
        </span>
        <a-popconfirm
          v-else-if="column.key === 'actions'"
          title="Revoke this token? The plugin using it stops being able to send."
          ok-text="Revoke"
          :ok-button-props="{ danger: true }"
          @confirm="revoke(record as PluginToken)"
        >
          <a-button size="small" danger>Revoke</a-button>
        </a-popconfirm>
      </template>
    </a-table>

    <div class="flex flex-wrap items-center gap-2">
      <a-input v-model:value="newName" placeholder="Token name, e.g. Desktop" :maxlength="50" class="max-w-64" @press-enter="create" />
      <a-button type="primary" :loading="creating" @click="create">New token</a-button>
    </div>

    <a-divider class="my-4!" />

    <div class="mb-2 flex flex-wrap items-center gap-2">
      <a-typography-text strong>Received</a-typography-text>
      <a-button size="small" :loading="loading" @click="load">Refresh</a-button>
      <a-popconfirm
        v-if="data?.characters.length"
        title="Delete everything the plugin has sent? Tokens stay."
        ok-text="Delete"
        :ok-button-props="{ danger: true }"
        @confirm="clearData"
      >
        <a-button size="small" danger>Delete received data</a-button>
      </a-popconfirm>
    </div>
    <a-empty v-if="!data?.characters.length" :image="Empty.PRESENTED_IMAGE_SIMPLE" description="Nothing received yet" />
    <div v-else class="flex flex-col gap-2">
      <div v-for="c in data.characters" :key="c.contentId" class="flex flex-wrap items-center gap-2">
        <span class="font-semibold">{{ c.snapshots.character?.data.name ?? c.contentId }}</span>
        <a-typography-text v-if="c.snapshots.character" type="secondary">{{ c.snapshots.character.data.world }}</a-typography-text>
        <template v-if="c.snapshots.character">
          <a-tag v-if="characters.isClaimed(c.snapshots.character.data.name, c.snapshots.character.data.world)" color="success" class="me-0!">
            <check-circle-outlined /> Verified
          </a-tag>
          <a-tooltip v-else title="Prove it's yours through the Lodestone, so no other account can send data for it">
            <a-button size="small" type="link" class="px-0!" @click="profile.modalOpen = true">Claim</a-button>
          </a-tooltip>
        </template>
        <a-tooltip v-for="kind in kindsOf(c)" :key="kind.kind" :title="`Received ${formatDate(kind.receivedAt)}`">
          <a-tag class="me-0!">{{ kind.kind }}</a-tag>
        </a-tooltip>
      </div>
      <a-typography-text type="secondary" class="text-xs">
        {{ data.events.length }} event{{ data.events.length === 1 ? '' : 's' }}
        <template v-if="data.events[0]">, the latest {{ formatDate(data.events[0].occurredAt) }}</template>
      </a-typography-text>
    </div>

    <a-modal v-model:open="tokenShown" title="New token" :footer="null">
      <a-alert type="warning" show-icon message="Copy it now: it's only shown once." class="mb-3!" />
      <a-typography-paragraph :copyable="{ text: shownToken }" class="break-all">
        <a-typography-text code>{{ shownToken }}</a-typography-text>
      </a-typography-paragraph>
      <a-typography-paragraph type="secondary" class="mb-0! text-xs">
        The plugin sends it as <a-typography-text code>Authorization: Bearer &lt;token&gt;</a-typography-text>.
      </a-typography-paragraph>
    </a-modal>
  </a-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Empty, message, type TableColumnType } from 'ant-design-vue'
import { storeToRefs } from 'pinia'
import { CheckCircleOutlined } from '@ant-design/icons-vue'
import { apiFetch } from '@/api/backend'
import { useCharacterStore } from '@/stores/characterStore'
import { usePluginStore } from '@/stores/pluginStore'
import { useProfileStore } from '@/stores/profileStore'
import type { NewPluginToken, PluginData, PluginSnapshotKind, PluginToken } from '@/types/plugin'

const ingestUrl = `${location.origin}/api/plugin/ingest`

const tokens = ref<PluginToken[]>([])
// Shared with pluginStore, so deleting the data here takes the plugin's marks off the other pages too
const { data } = storeToRefs(usePluginStore())
const characters = useCharacterStore()
const profile = useProfileStore()
const loading = ref(false)

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))
const formatDate = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

async function load() {
  loading.value = true
  try {
    ;[tokens.value, data.value] = await Promise.all([apiFetch<PluginToken[]>('/plugin/tokens'), apiFetch<PluginData>('/plugin/data')])
  } catch (err) {
    message.error(`Couldn't load the plugin's data: ${errorText(err)}`)
  }
  loading.value = false
}
onMounted(load)

const newName = ref('')
const creating = ref(false)
const tokenShown = ref(false)
const shownToken = ref('')

async function create() {
  creating.value = true
  try {
    const created = await apiFetch<NewPluginToken>('/plugin/tokens', { method: 'POST', body: { name: newName.value } })
    tokens.value.push(created)
    shownToken.value = created.token
    tokenShown.value = true
    newName.value = ''
  } catch (err) {
    message.error(`Couldn't make a token: ${errorText(err)}`)
  }
  creating.value = false
}

async function revoke(token: PluginToken) {
  try {
    await apiFetch(`/plugin/tokens/${token.id}`, { method: 'DELETE' })
    tokens.value = tokens.value.filter((t) => t.id !== token.id)
  } catch (err) {
    message.error(`Couldn't revoke the token: ${errorText(err)}`)
  }
}

async function clearData() {
  try {
    await apiFetch('/plugin/data', { method: 'DELETE' })
    data.value = { characters: [], events: [] }
  } catch (err) {
    message.error(`Couldn't delete the data: ${errorText(err)}`)
  }
}

// The snapshot kinds a character has, `character` aside (its name and world are shown already)
const kindsOf = (c: PluginData['characters'][number]) =>
  (Object.keys(c.snapshots) as PluginSnapshotKind[])
    .filter((kind) => kind !== 'character')
    .map((kind) => ({ kind, receivedAt: c.snapshots[kind]!.receivedAt }))

const tokenColumns: TableColumnType[] = [
  { key: 'name', title: 'Name' },
  { key: 'createdAt', title: 'Made' },
  { key: 'lastUsedAt', title: 'Last used' },
  { key: 'actions', title: '', align: 'right' },
]
</script>

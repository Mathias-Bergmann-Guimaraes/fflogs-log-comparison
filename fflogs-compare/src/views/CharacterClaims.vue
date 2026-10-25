<template>
  <!-- Claiming characters through the Lodestone (characterStore): a code goes in the character's Lodestone profile, then
       the server looks for it there. In the Profile modal. -->
  <div class="flex flex-col gap-3">
    <div v-for="c in characters.claimed" :key="c.lodestoneId" class="flex flex-wrap items-center gap-2">
      <a-avatar :src="c.avatar" :size="28">
        <template #icon><user-outlined /></template>
      </a-avatar>
      <span class="font-semibold">{{ c.name }}</span>
      <a-typography-text type="secondary">{{ worldLabel(c) }}</a-typography-text>
      <span class="flex items-center">
        <a-tooltip v-for="site in sitesOf(c)" :key="site.name" :title="site.name">
          <a-button type="text" size="small" :href="site.url" target="_blank" rel="noopener" :aria-label="site.name">
            <template #icon><img :src="site.icon" alt="" class="inline-block size-4 rounded-sm" /></template>
          </a-button>
        </a-tooltip>
      </span>
      <a-tooltip :title="`Verified ${formatDate(c.verifiedAt)}`">
        <a-tag color="success" class="me-0!"><check-circle-outlined /> Verified</a-tag>
      </a-tooltip>
      <a-tag v-if="c.fflogs" color="blue" class="me-0!">FF Logs</a-tag>
      <a-tooltip title="Update the name, world and portrait from the Lodestone">
        <a-button size="small" :loading="refreshing === c.lodestoneId" @click="refresh(c)">
          <template #icon><sync-outlined /></template>
        </a-button>
      </a-tooltip>
      <a-popconfirm title="Remove this character from your account?" ok-text="Remove" :ok-button-props="{ danger: true }" @confirm="remove(c)">
        <a-button size="small" danger>Remove</a-button>
      </a-popconfirm>
    </div>

    <a-card v-for="p in characters.pending" :key="p.lodestoneId" size="small">
      <template #title>
        <span class="flex flex-wrap items-center gap-2">
          <span class="truncate">{{ p.name }}</span>
          <a-typography-text type="secondary" class="text-xs font-normal">{{ worldLabel(p) }}</a-typography-text>
        </span>
      </template>
      <template #extra>
        <a-button size="small" type="text" @click="remove(p)">Cancel</a-button>
      </template>
      <ol class="mb-3 list-decimal ps-5">
        <li>
          Copy this code:
          <a-typography-text code :copyable="{ text: p.code }">{{ p.code }}</a-typography-text>
        </li>
        <li>
          Paste it anywhere in
          <a-typography-link :href="LODESTONE_PROFILE_SETTINGS" target="_blank" rel="noopener">
            {{ p.name }}'s Character Profile on the Lodestone <export-outlined />
          </a-typography-link>
          and save.
        </li>
        <li>Come back and click the button. You can take the code out again afterwards.</li>
      </ol>
      <a-alert v-if="errors[p.lodestoneId]" type="error" show-icon :message="errors[p.lodestoneId]" class="mb-3!" />
      <div class="flex flex-wrap items-center gap-2">
        <a-button type="primary" :loading="verifying === p.lodestoneId" @click="verify(p)">I've updated my Lodestone</a-button>
        <a-typography-text type="secondary" class="text-xs">The code works until {{ formatDate(p.expiresAt) }}</a-typography-text>
      </div>
    </a-card>

    <a-form-item
      :validate-status="startError ? 'error' : undefined"
      :help="startError || 'Your character\'s Lodestone page, to prove it\'s yours.'"
      class="mb-0!"
    >
      <div class="flex flex-wrap gap-2">
        <a-input
          v-model:value="link"
          placeholder="https://na.finalfantasyxiv.com/lodestone/character/12345678/"
          allow-clear
          class="min-w-48 flex-1"
          @change="startError = ''"
          @press-enter="start"
        />
        <a-button :loading="starting" :disabled="!link.trim()" @click="start">Claim</a-button>
      </div>
    </a-form-item>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { CheckCircleOutlined, ExportOutlined, SyncOutlined, UserOutlined } from '@ant-design/icons-vue'
import { useCharacterStore } from '@/stores/characterStore'
import { LODESTONE_PROFILE_SETTINGS, fflogsUrl, lodestoneUrl, tomestoneUrl, type LodestoneCharacter } from '@/types/characters'

const characters = useCharacterStore()

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))
const formatDate = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const worldLabel = (c: LodestoneCharacter) => (c.dataCenter ? `${c.world} [${c.dataCenter}]` : c.world)

// The character's pages elsewhere, each by its Lodestone id; the icons are in public/sites
const sitesOf = (c: LodestoneCharacter) => [
  { name: 'FF Logs', url: fflogsUrl(c.lodestoneId), icon: '/sites/fflogs.png' },
  { name: 'Tomestone.gg', url: tomestoneUrl(c), icon: '/sites/tomestone.png' },
  { name: 'The Lodestone', url: lodestoneUrl(c.lodestoneId), icon: '/sites/lodestone.png' },
]

const link = ref('')
const starting = ref(false)
const startError = ref('')

async function start() {
  starting.value = true
  try {
    await characters.start(link.value)
    link.value = ''
  } catch (err) {
    startError.value = errorText(err)
  }
  starting.value = false
}

// Per pending claim: why the last check didn't claim it
const errors = reactive<Record<string, string>>({})
const verifying = ref<string>()

async function verify(p: LodestoneCharacter) {
  verifying.value = p.lodestoneId
  delete errors[p.lodestoneId]
  try {
    const c = await characters.verify(p.lodestoneId)
    message.success(`${c.name} is yours. You can take the code off the Lodestone now.`)
  } catch (err) {
    errors[p.lodestoneId] = errorText(err)
  }
  verifying.value = undefined
}

const refreshing = ref<string>()
async function refresh(c: LodestoneCharacter) {
  refreshing.value = c.lodestoneId
  try {
    await characters.refresh(c.lodestoneId)
  } catch (err) {
    message.error(`Couldn't update ${c.name}: ${errorText(err)}`)
  }
  refreshing.value = undefined
}

async function remove(c: LodestoneCharacter) {
  try {
    await characters.remove(c.lodestoneId)
    delete errors[c.lodestoneId]
  } catch (err) {
    message.error(`Couldn't remove ${c.name}: ${errorText(err)}`)
  }
}
</script>

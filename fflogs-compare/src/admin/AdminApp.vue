<template>
  <a-config-provider :theme="{ algorithm: theme.darkAlgorithm }">
    <a-layout class="min-h-screen">
      <a-layout-header class="flex items-center justify-between">
        <span>FFXIV COMPANION · ADMIN</span>
        <a-button size="small" :loading="loading" @click="load">Refresh</a-button>
      </a-layout-header>

      <a-layout-content class="p-5">
        <a-alert v-if="loadError" class="mb-4" type="error" show-icon :message="loadError" />
        <div class="mb-4 flex items-center gap-3">
          <a-input-search v-model:value="search" class="max-w-xs" placeholder="Search username or email" allow-clear />
          <a-typography-text type="secondary">{{ filteredUsers.length }} of {{ users.length }} accounts</a-typography-text>
        </div>

        <a-table :columns="columns" :data-source="filteredUsers" :loading="loading" row-key="id" size="middle" :pagination="{ pageSize: 50 }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'login'">
              <a-tag v-if="record.hasPassword">Password</a-tag>
              <a-tag v-for="o in record.oauth" :key="o.provider" color="blue">{{ o.provider }}{{ o.email ? `: ${o.email}` : '' }}</a-tag>
            </template>
            <template v-else-if="column.key === 'createdAt'">{{ formatDate(record.createdAt) }}</template>
            <template v-else-if="column.key === 'lastLoginAt'">{{ record.lastLoginAt ? formatDate(record.lastLoginAt) : '—' }}</template>
            <template v-else-if="String(column.key).startsWith('feature:')">
              <a-switch
                :checked="record.features.includes(featureOf(column))"
                :loading="pending.has(`${record.id}:${featureOf(column)}`)"
                @change="(on: boolean) => toggleFeature(record, featureOf(column), on)"
              />
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space>
                <a-popconfirm title="Log this user out on every device?" :disabled="!record.sessions" @confirm="logOut(record)">
                  <a-button size="small" :disabled="!record.sessions">Log out</a-button>
                </a-popconfirm>
                <a-button size="small" @click="passwordUser = record">Set password</a-button>
                <a-popconfirm :title="`Delete ${record.username} and all their data? This can't be undone.`" ok-text="Delete" :ok-button-props="{ danger: true }" @confirm="remove(record)">
                  <a-button size="small" danger>Delete</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-layout-content>
    </a-layout>

    <a-modal :open="!!passwordUser" :title="`New password for ${passwordUser?.username}`" ok-text="Set password" :confirm-loading="savingPassword" @ok="savePassword" @cancel="closePasswordModal">
      <a-typography-paragraph type="secondary">They'll be logged out everywhere and can log in with this password, also if they only used Google so far.</a-typography-paragraph>
      <a-input-password v-model:value="newPassword" placeholder="At least 8 characters" @press-enter="savePassword" />
    </a-modal>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { message, theme, type TableColumnType } from 'ant-design-vue'
import type { AdminOverview, AdminUser } from '@/types/admin'
import { adminFetch } from './api'

// Column titles for FEATURES in server/features.ts; anything missing here shows its raw name
const FEATURE_LABELS: Record<string, string> = { hunts: 'Hunt Tracker' }

const users = ref<AdminUser[]>([])
const features = ref<string[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const search = ref('')
// "<user id>:<feature>" of switches waiting on the server
const pending = reactive(new Set<string>())

const columns = computed<TableColumnType<AdminUser>[]>(() => [
  { title: 'Username', dataIndex: 'username', key: 'username', sorter: (a, b) => a.username.localeCompare(b.username) },
  { title: 'Login', key: 'login' },
  { title: 'Created', key: 'createdAt', sorter: (a, b) => a.createdAt - b.createdAt, defaultSortOrder: 'descend' },
  { title: 'Last login', key: 'lastLoginAt', sorter: (a, b) => (a.lastLoginAt ?? 0) - (b.lastLoginAt ?? 0) },
  { title: 'Sessions', dataIndex: 'sessions', key: 'sessions', sorter: (a, b) => a.sessions - b.sessions },
  ...features.value.map((f) => ({ title: FEATURE_LABELS[f] ?? f, key: `feature:${f}` })),
  { title: '', key: 'actions', align: 'right' },
])

const filteredUsers = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter((u) => u.username.toLowerCase().includes(q) || u.oauth.some((o) => o.email?.toLowerCase().includes(q)))
})

const featureOf = (column: { key?: unknown }) => String(column.key).slice('feature:'.length)
const formatDate = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

async function load() {
  loading.value = true
  try {
    const overview = await adminFetch<AdminOverview>('/users')
    users.value = overview.users
    features.value = overview.features
    loadError.value = null
  } catch (err) {
    loadError.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

async function toggleFeature(user: AdminUser, feature: string, enabled: boolean) {
  const key = `${user.id}:${feature}`
  pending.add(key)
  try {
    await adminFetch(`/users/${user.id}/features/${feature}`, { method: 'PUT', body: { enabled } })
    user.features = enabled ? [...user.features, feature] : user.features.filter((f) => f !== feature)
  } catch (err) {
    message.error((err as Error).message)
  } finally {
    pending.delete(key)
  }
}

async function logOut(user: AdminUser) {
  try {
    await adminFetch(`/users/${user.id}/sessions`, { method: 'DELETE' })
    user.sessions = 0
    message.success(`${user.username} is logged out everywhere`)
  } catch (err) {
    message.error((err as Error).message)
  }
}

async function remove(user: AdminUser) {
  try {
    await adminFetch(`/users/${user.id}`, { method: 'DELETE' })
    users.value = users.value.filter((u) => u.id !== user.id)
    message.success(`Deleted ${user.username}`)
  } catch (err) {
    message.error((err as Error).message)
  }
}

const passwordUser = ref<AdminUser | null>(null)
const newPassword = ref('')
const savingPassword = ref(false)

function closePasswordModal() {
  passwordUser.value = null
  newPassword.value = ''
}

async function savePassword() {
  const user = passwordUser.value
  if (!user) return
  savingPassword.value = true
  try {
    await adminFetch(`/users/${user.id}/password`, { method: 'PUT', body: { password: newPassword.value } })
    user.hasPassword = true
    user.sessions = 0
    message.success(`Password set for ${user.username}`)
    closePasswordModal()
  } catch (err) {
    message.error((err as Error).message)
  } finally {
    savingPassword.value = false
  }
}

load()
</script>

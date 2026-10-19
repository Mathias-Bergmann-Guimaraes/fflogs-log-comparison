import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError, apiFetch } from '@/api/backend'

// features: what's been switched on for this account on the admin page (FEATURES in server/features.ts)
export type User = { id: number; username: string; features: string[] }

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  // Resolves once the session cookie has been checked, so the router guard can await it
  let loaded: Promise<void> | null = null

  function ensureLoaded() {
    loaded ??= apiFetch<User>('/auth/me')
      .then((u) => {
        user.value = u
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) console.error(err)
        user.value = null
      })
    return loaded
  }

  async function login(username: string, password: string) {
    user.value = await apiFetch<User>('/auth/login', { method: 'POST', body: { username, password } })
  }

  async function register(username: string, password: string) {
    user.value = await apiFetch<User>('/auth/register', { method: 'POST', body: { username, password } })
  }

  const hasFeature = (feature: string) => user.value?.features.includes(feature) ?? false

  async function logout() {
    await apiFetch('/auth/logout', { method: 'POST' })
    user.value = null
  }

  return { user, ensureLoaded, hasFeature, login, register, logout }
})

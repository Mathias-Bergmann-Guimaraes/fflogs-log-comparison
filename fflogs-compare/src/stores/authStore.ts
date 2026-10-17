import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError, apiFetch } from '@/api/backend'

export type User = { id: number; username: string }

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

  async function logout() {
    await apiFetch('/auth/logout', { method: 'POST' })
    user.value = null
  }

  return { user, ensureLoaded, login, register, logout }
})

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { apiFetch } from '@/api/backend'
import { useAuthStore } from './authStore'

// Custom gear sets (server/gearSets.ts): a named group of jobs with an item level range, tracked apart from the
// default set. Each one's progress is its own bisStore (useBisStore(id)).
export type GearSet = { id: number; name: string; jobs: string[]; minIlvl: number; maxIlvl: number }
export type GearSetDraft = Omit<GearSet, 'id'>

export const useGearSetsStore = defineStore('gearSets', () => {
  const sets = ref<GearSet[]>([])

  async function load() {
    sets.value = await apiFetch<GearSet[]>('/gear-sets')
  }

  const byId = (id: number) => sets.value.find((s) => s.id === id)

  // These throw, so the dialogs can stay open and show why
  async function create(draft: GearSetDraft): Promise<GearSet> {
    const set = await apiFetch<GearSet>('/gear-sets', { method: 'POST', body: draft })
    sets.value.push(set)
    return set
  }

  async function update(id: number, draft: GearSetDraft) {
    const set = await apiFetch<GearSet>(`/gear-sets/${id}`, { method: 'PUT', body: draft })
    sets.value = sets.value.map((s) => (s.id === id ? set : s))
  }

  async function remove(id: number) {
    await apiFetch(`/gear-sets/${id}`, { method: 'DELETE' })
    sets.value = sets.value.filter((s) => s.id !== id)
  }

  const auth = useAuthStore()
  watch(
    () => auth.user?.id,
    () => (sets.value = []),
  )

  return { sets, load, byId, create, update, remove }
})

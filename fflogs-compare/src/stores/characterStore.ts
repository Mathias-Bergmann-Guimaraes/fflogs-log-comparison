import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { apiFetch } from '@/api/backend'
import type { CharacterClaims, ClaimedCharacter, PendingClaim } from '@/types/characters'
import { useAuthStore } from './authStore'

// The account's characters claimed through the Lodestone (server/characters.ts), and the codes still waiting.
// The calls throw; the Profile modal shows their errors where they happened.
export const useCharacterStore = defineStore('characters', () => {
  const auth = useAuthStore()
  const claimed = ref<ClaimedCharacter[]>([])
  const pending = ref<PendingClaim[]>([])

  async function load() {
    const userId = auth.user?.id
    if (userId === undefined) return
    try {
      const claims = await apiFetch<CharacterClaims>('/characters')
      if (auth.user?.id !== userId) return // switched account meanwhile
      claimed.value = claims.claimed
      pending.value = claims.pending
    } catch (err) {
      console.error("Couldn't load the claimed characters", err)
    }
  }

  watch(
    () => auth.user?.id,
    (userId) => {
      claimed.value = []
      pending.value = []
      if (userId !== undefined) void load()
    },
    { immediate: true },
  )

  // lodestone: the character's Lodestone link or id. Gives the code to put in its Lodestone profile.
  async function start(lodestone: string) {
    const claim = await apiFetch<PendingClaim>('/characters', { method: 'POST', body: { lodestone } })
    pending.value = [...pending.value.filter((p) => p.lodestoneId !== claim.lodestoneId), claim]
    return claim
  }

  async function verify(lodestoneId: string) {
    const character = await apiFetch<ClaimedCharacter>(`/characters/${lodestoneId}/verify`, { method: 'POST' })
    pending.value = pending.value.filter((p) => p.lodestoneId !== lodestoneId)
    claimed.value = [...claimed.value.filter((c) => c.lodestoneId !== lodestoneId), character]
    return character
  }

  // The claimed character FF Logs features use, if one is picked. setFFLogs(null) picks none.
  const fflogsCharacter = computed(() => claimed.value.find((c) => c.fflogs))
  async function setFFLogs(lodestoneId: string | null) {
    await apiFetch('/characters/fflogs', { method: 'PUT', body: { lodestoneId } })
    claimed.value = claimed.value.map((c) => ({ ...c, fflogs: c.lodestoneId === lodestoneId }))
  }

  // Name, world and portrait as the Lodestone shows them now
  async function refresh(lodestoneId: string) {
    const character = await apiFetch<ClaimedCharacter>(`/characters/${lodestoneId}/refresh`, { method: 'POST' })
    claimed.value = claimed.value.map((c) => (c.lodestoneId === lodestoneId ? character : c))
    return character
  }

  // The site's avatar for the account: the FF Logs character's Lodestone portrait, else the first claimed one's
  const avatarCharacter = computed(() => fflogsCharacter.value ?? claimed.value[0])
  const avatar = computed(() => avatarCharacter.value?.avatar)
  // Claims made before portraits were kept have none: read it from the Lodestone once
  const fetchedAvatar = new Set<string>()
  watch(avatarCharacter, (c) => {
    if (!c || c.avatar || fetchedAvatar.has(c.lodestoneId)) return
    fetchedAvatar.add(c.lodestoneId)
    refresh(c.lodestoneId).catch((err) => console.error("Couldn't get the character's portrait", err))
  })

  async function remove(lodestoneId: string) {
    await apiFetch(`/characters/${lodestoneId}`, { method: 'DELETE' })
    pending.value = pending.value.filter((p) => p.lodestoneId !== lodestoneId)
    claimed.value = claimed.value.filter((c) => c.lodestoneId !== lodestoneId)
  }

  // Whether the account has claimed the character with this name on this home world (the plugin's characters)
  const isClaimed = (name: string, world: string) =>
    claimed.value.some((c) => c.name.toLowerCase() === name.toLowerCase() && c.world.toLowerCase() === world.toLowerCase())

  return { claimed, pending, load, start, verify, refresh, remove, isClaimed, fflogsCharacter, setFFLogs, avatar }
})

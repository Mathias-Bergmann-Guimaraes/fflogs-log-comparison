import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { apiFetch } from '@/api/backend'
import { isCharacter, type FFLogsCharacter } from '@/api/fflogsCharacter'
import { useAuthStore } from './authStore'

// Saved per account in the profile setting.
// fflogsCharacter: the player's own FF Logs character (the Ultimate Weapons page syncs its clears)
type Profile = { fflogsCharacter?: FFLogsCharacter }

function normalize(saved: unknown): Profile {
  const raw = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>
  return isCharacter(raw.fflogsCharacter) ? { fflogsCharacter: raw.fflogsCharacter } : {}
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

export const useProfileStore = defineStore('profile', () => {
  const profile = ref<Profile>({})
  // Whether the profile modal (in the layout) is open; any page can open it
  const modalOpen = ref(false)

  // On login (and account switch): start empty, then load this user's profile
  const auth = useAuthStore()
  watch(
    () => auth.user?.id,
    async (userId) => {
      profile.value = {}
      if (userId === undefined) return
      try {
        const { value } = await apiFetch<{ value: unknown }>('/settings/profile')
        if (auth.user?.id !== userId) return // switched account meanwhile
        profile.value = normalize(value)
      } catch (err) {
        console.error("Couldn't load the profile", err)
      }
    },
    { immediate: true },
  )

  const fflogsCharacter = computed(() => profile.value.fflogsCharacter)

  // Optimistic like the other settings; false (and the previous character back) if the save fails
  async function setFFLogsCharacter(character: FFLogsCharacter | undefined) {
    const previous = profile.value
    const next = { ...previous }
    if (character) next.fflogsCharacter = character
    else delete next.fflogsCharacter
    profile.value = next
    try {
      await apiFetch('/settings/profile', { method: 'PUT', body: { value: next } })
      return true
    } catch (err) {
      profile.value = previous
      message.error(`Couldn't save your profile: ${errorText(err)}`)
      return false
    }
  }

  return { fflogsCharacter, setFFLogsCharacter, modalOpen }
})

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { FFLogsCharacter } from '@/api/fflogsCharacter'
import { useCharacterStore } from './characterStore'

// The account's profile, shown in the profile modal.
// fflogsCharacter: the player's own FF Logs character (the Ultimate Weapons page syncs its clears). Only a character
// claimed through the Lodestone can be it (characterStore); FF Logs finds it by its Lodestone id.
export const useProfileStore = defineStore('profile', () => {
  const characters = useCharacterStore()
  // Whether the profile modal (in the layout) is open; any page can open it
  const modalOpen = ref(false)

  const fflogsCharacter = computed((): FFLogsCharacter | undefined => {
    const c = characters.fflogsCharacter
    return c && { lodestoneId: Number(c.lodestoneId), name: c.name, server: c.world }
  })

  return { fflogsCharacter, modalOpen }
})

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { apiFetch } from '@/api/backend'
import { EquipmentStatus } from '@/types/EquipmentType'
import { useAuthStore } from './authStore'

// Only slots the user has changed; anything missing is EquipmentStatus.RAID
type SavedSlots = Record<string, Record<number, EquipmentStatus>>

export const useBisStore = defineStore('bis', () => {
  const slots = ref<SavedSlots>({})
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      slots.value = await apiFetch<SavedSlots>('/bis')
    } finally {
      loading.value = false
    }
  }

  function statusOf(job: string, slotIndex: number): EquipmentStatus {
    return slots.value[job]?.[slotIndex] ?? EquipmentStatus.RAID
  }

  // Optimistic: update the UI now, roll back if the server rejects it
  async function setStatus(job: string, slotIndex: number, status: EquipmentStatus) {
    const previous = statusOf(job, slotIndex)
    ;(slots.value[job] ??= {})[slotIndex] = status
    try {
      await apiFetch(`/bis/${job}/${slotIndex}`, { method: 'PUT', body: { status } })
    } catch (err) {
      slots.value[job]![slotIndex] = previous
      message.error(`Couldn't save: ${err instanceof Error ? err.message : err}`)
    }
  }

  // Don't leak one user's gear into the next account on the same tab
  const auth = useAuthStore()
  watch(
    () => auth.user?.id,
    () => {
      slots.value = {}
    },
  )

  return { slots, loading, load, statusOf, setStatus }
})

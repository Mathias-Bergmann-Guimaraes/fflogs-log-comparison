import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { apiFetch } from '@/api/backend'
import { jobsByRole } from '@/constants/jobs'
import { useAuthStore } from './authStore'

const allJobs = jobsByRole.flatMap((group) => group.jobs)

// Starred jobs, saved per account. They're the priority too: their gear is bought and handed out first,
// in the order they were starred.
export const useFavoritesStore = defineStore('favorites', () => {
  const jobs = ref<string[]>([])

  // On login (and account switch): start empty, then load this user's stars
  const auth = useAuthStore()
  watch(
    () => auth.user?.id,
    async (userId) => {
      jobs.value = []
      if (userId === undefined) return
      try {
        const { value } = await apiFetch<{ value: unknown }>('/settings/favoriteJobs')
        if (auth.user?.id !== userId) return // switched account meanwhile
        if (Array.isArray(value)) jobs.value = value.filter((job): job is string => allJobs.includes(job))
      } catch (err) {
        console.error("Couldn't load favorite jobs", err)
      }
    },
    { immediate: true },
  )

  const isFavorite = (job: string) => jobs.value.includes(job)

  // Optimistic: star/unstar now, roll back if the save fails
  async function toggle(job: string) {
    const previous = jobs.value
    jobs.value = isFavorite(job) ? previous.filter((j) => j !== job) : [...previous, job]
    try {
      await apiFetch('/settings/favoriteJobs', { method: 'PUT', body: { value: jobs.value } })
    } catch (err) {
      jobs.value = previous
      message.error(`Couldn't save favorites: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Every job, favorites first: the order gear is bought and handed out in
  const jobOrder = computed(() => [...jobs.value, ...allJobs.filter((job) => !isFavorite(job))])

  return { jobs, isFavorite, toggle, jobOrder }
})

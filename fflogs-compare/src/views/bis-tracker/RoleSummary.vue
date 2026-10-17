<template>
  <!-- @click.stop: lives in the collapse header, so hovering/clicking here shouldn't toggle the panel -->
  <div class="flex items-center gap-4" @click.stop>
    <a-tooltip :title="`${progress.acquired} of ${progress.total} items acquired`">
      <div class="flex items-center gap-2">
        <!-- Width on a plain wrapper: Ant's progress styles override Tailwind sizing on the component itself -->
        <div class="w-24 shrink-0">
          <a-progress :percent="progress.percent" :show-info="false" size="small" class="m-0!" />
        </div>
        <a-typography-text type="secondary" class="text-xs whitespace-nowrap tabular-nums">
          {{ progress.acquired }} / {{ progress.total }}
        </a-typography-text>
      </div>
    </a-tooltip>

    <a-divider type="vertical" class="m-0!" />

    <a-tooltip v-for="m in materialDefs" :key="m.key" placement="bottom">
      <template #title>
        <div class="mb-1 font-semibold">{{ m.label }}</div>
        <div v-for="j in perJob" :key="j.job" class="flex justify-between gap-6 tabular-nums">
          <span>{{ jobDisplayName(j.job) }}</span>
          <span>{{ j.materials[m.key].toLocaleString() }}</span>
        </div>
      </template>
      <span class="inline-flex cursor-default items-center gap-1.5">
        <img :src="m.icon" alt="" class="size-5" />
        <a-typography-text :type="total[m.key] === 0 ? 'success' : undefined" class="text-sm tabular-nums">
          {{ total[m.key].toLocaleString() }}
        </a-typography-text>
      </span>
    </a-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EquipmentStatus } from '@/types/EquipmentType'
import { bisSlots } from '@/constants/bisSlots'
import { jobDisplayName } from '@/constants/jobs'
import { materialDefs } from '@/constants/materials'
import { useBisStore } from '@/stores/bisStore'

const props = defineProps<{ jobs: readonly string[] }>()

const bis = useBisStore()

// Linked items count once in the role total, but in full for each job in the tooltip
const total = computed(() => bis.materialsNeeded(props.jobs))
const perJob = computed(() => props.jobs.map((job) => ({ job, materials: bis.materialsNeeded([job]) })))

const progress = computed(() => {
  const total = props.jobs.length * bisSlots.length
  const acquired = props.jobs.reduce((sum, job) => sum + bisSlots.filter((_, i) => bis.statusOf(job, i) === EquipmentStatus.ACQUIRED).length, 0)
  return { acquired, total, percent: Math.round((acquired / total) * 100) }
})
</script>

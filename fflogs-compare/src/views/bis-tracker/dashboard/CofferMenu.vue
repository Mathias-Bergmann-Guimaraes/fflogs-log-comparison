<template>
  <!-- Like EquipmentSlot: click the coffer icon (the slot content) for a menu of who to give it to -->
  <a-dropdown :trigger="['click']">
    <slot />

    <template #overlay>
      <a-menu @click="onClick">
        <a-menu-item-group :title="held ? `Give ${def.label} coffer to` : `No ${def.label} coffers held: add one with +`">
          <a-menu-item v-if="!recipients.length" key="none" disabled>No tracked job still needs it from raid</a-menu-item>

          <!-- One row per purchase: linked jobs share the piece, so they sit side by side and one coffer covers them all -->
          <a-menu-item v-for="r in recipients" :key="r.id" :disabled="!held">
            <div class="flex items-center gap-2">
              <div class="flex gap-0.5 rounded p-0.5" :class="r.jobs.length > 1 && 'bg-gray-700'">
                <!-- Job icons are 76px: 19px is exactly a quarter -->
                <img v-for="job in r.jobs" :key="job" :src="`/job/${job}.png`" :alt="jobDisplayName(job)" class="size-4.75 rounded-sm" />
              </div>
              <span v-if="r.jobs.length === 1">{{ jobDisplayName(r.job) }}</span>
              <a-typography-text v-if="def.type === EquipmentType.RING" type="secondary" class="text-xs">
                {{ bisSlotLabels[r.slot] }}
              </a-typography-text>
            </div>
          </a-menu-item>
        </a-menu-item-group>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EquipmentStatus, EquipmentType } from '@/types/EquipmentType'
import { bisSlotLabels, bisSlots } from '@/constants/bisSlots'
import { cofferDefs } from '@/constants/coffers'
import { jobDisplayName } from '@/constants/jobs'
import { allJobs } from '@/composables/useBisPlan'
import { useBisStore } from '@/stores/bisStore'
import { useStockStore } from '@/stores/stockStore'
import { useFavoritesStore } from '@/stores/favoritesStore'

const props = defineProps<{ type: EquipmentType }>()
// After a successful give: what happened, and how to take it back (the parent shows the undo)
const emit = defineEmits<{ given: [message: string, undo: () => Promise<void>] }>()

type Recipient = { id: string; job: string; slot: number; jobs: string[] }

const bis = useBisStore()
const stockStore = useStockStore()
const favorites = useFavoritesStore()

const def = computed(() => cofferDefs.find((c) => c.type === props.type)!)
const held = computed(() => stockStore.stock.coffers[props.type])

// Raid pieces of this slot type still needed, one per link group, in job order (favorites first)
const recipients = computed<Recipient[]>(() =>
  bis
    .raidPieces(favorites.jobOrder)
    .filter((p) => bisSlots[p.slot] === props.type)
    .map((p) => ({
      id: `${p.job}:${p.slot}`,
      job: p.job,
      slot: p.slot,
      jobs: [p.job, ...bis.linkedOnSlot(p.job, p.slot)].filter((j) => allJobs.includes(j)),
    })),
)

function onClick({ key }: { key: string | number }) {
  const recipient = recipients.value.find((r) => r.id === key)
  if (recipient) give(recipient)
}

// Marks the piece acquired (for every linked job) and uses up one coffer
async function give(recipient: Recipient) {
  const type = props.type
  if (!held.value) return
  const previous = bis.statusOf(recipient.job, recipient.slot)
  if (!(await bis.setStatus(recipient.job, recipient.slot, EquipmentStatus.ACQUIRED))) return // store showed the error
  stockStore.stock.coffers[type]--

  emit('given', `${def.value.label} coffer given to ${recipient.jobs.map(jobDisplayName).join(' + ')}`, async () => {
    if (await bis.setStatus(recipient.job, recipient.slot, previous)) stockStore.stock.coffers[type]++
  })
}
</script>

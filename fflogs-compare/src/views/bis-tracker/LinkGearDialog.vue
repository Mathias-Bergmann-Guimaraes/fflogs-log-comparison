<template>
  <a-modal
    v-model:open="open"
    :title="`Link ${displayName}'s gear`"
    :width="600"
    ok-text="Apply"
    :ok-button-props="{ disabled: !changed }"
    :confirm-loading="saving"
    @ok="onApply"
  >
    <p class="mb-4 text-sm text-gray-400">
      Pick the jobs and items {{ displayName }} shares. Changing a linked item on any of them updates all of them. Newly linked items take on
      {{ displayName }}'s progress.
    </p>

    <table class="w-full border-separate border-spacing-y-1">
      <thead>
        <tr class="text-xs text-gray-500">
          <th />
          <th class="pb-1 text-left font-normal" :colspan="ARMOUR_SLOTS.length">Armour</th>
          <th class="w-2" />
          <th class="pb-1 text-left font-normal" :colspan="ACCESSORY_SLOTS.length">Accessories</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.job">
          <td class="pr-3">
            <a-checkbox :checked="row.state === 'all'" :indeterminate="row.state === 'some'" @change="toggleJob(row.job, $event.target.checked)">
              <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                <img :src="`/job/${row.job}.png`" alt="" class="size-5" />
                {{ jobDisplayName(row.job) }}
              </span>
            </a-checkbox>
          </td>
          <template v-for="i in SLOT_COUNT" :key="i">
            <td v-if="i - 1 === ACCESSORY_SLOTS[0]" />
            <td class="px-0.5">
              <button
                v-if="row.shareable.includes(i - 1)"
                type="button"
                class="block size-8 cursor-pointer rounded border-2 p-0.5 transition"
                :class="draft[row.job]!.has(i - 1) ? 'border-blue-400 bg-blue-900/50' : 'border-gray-700 opacity-35 hover:opacity-75'"
                :title="`${bisSlotLabels[i - 1]}: ${draft[row.job]!.has(i - 1) ? 'linked' : 'not linked'}`"
                @click="toggleSlot(row.job, i - 1)"
              >
                <img :src="equipmentIcons[bisSlots[i - 1]!]" alt="" class="size-full rounded-sm" />
              </button>
              <div
                v-else
                class="size-8 rounded border-2 border-dashed border-gray-800"
                :title="`${jobDisplayName(row.job)} can't wear ${displayName}'s ${bisSlotLabels[i - 1]}`"
              />
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <a-alert v-if="warnings.length" type="warning" show-icon class="mt-4">
      <template #message>
        <ul class="m-0 list-none p-0">
          <li v-for="w in warnings" :key="w">{{ w }}</li>
        </ul>
      </template>
    </a-alert>
    <a-alert v-if="error" type="error" :message="error" show-icon class="mt-4" />
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { EquipmentStatus } from '@/types/EquipmentType'
import { equipmentIcons } from '@/constants/icons'
import { bisSlotLabels, bisSlots } from '@/constants/bisSlots'
import { jobDisplayName } from '@/constants/jobs'
import { ACCESSORY_SLOTS, ARMOUR_SLOTS, SLOT_COUNT, linkableJobs, sharedSlots } from '@/constants/gearSharing'
import { useBisStore } from '@/stores/bisStore'

const props = defineProps<{ job: string }>()
const open = defineModel<boolean>('open', { required: true })

const bis = useBisStore()
const displayName = computed(() => jobDisplayName(props.job))
const candidates = computed(() => linkableJobs(props.job))

// What's linked now, and the edited copy; nothing is saved until Apply
const current = (other: string) => new Set(sharedSlots(props.job, other).filter((i) => bis.isLinked(props.job, other, i)))
const draft = ref<Record<string, Set<number>>>({})
const saving = ref(false)
const error = ref<string | null>(null)

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    draft.value = Object.fromEntries(candidates.value.map((other) => [other, current(other)]))
    error.value = null
  },
  { immediate: true },
)

const rows = computed(() =>
  candidates.value.map((other) => {
    const shareable = sharedSlots(props.job, other)
    const picked = draft.value[other]?.size ?? 0
    return { job: other, shareable, state: picked === 0 ? 'none' : picked === shareable.length ? 'all' : 'some' }
  }),
)

function toggleJob(other: string, checked: boolean) {
  draft.value[other] = new Set(checked ? sharedSlots(props.job, other) : [])
}

function toggleSlot(other: string, slotIndex: number) {
  const slots = draft.value[other]!
  if (slots.has(slotIndex)) slots.delete(slotIndex)
  else slots.add(slotIndex)
}

// Slots that would become linked, per job
const added = computed(() =>
  candidates.value.map((other) => {
    const before = current(other)
    return { other, slots: [...(draft.value[other] ?? [])].filter((i) => !before.has(i)).sort((a, b) => a - b) }
  }),
)

const changed = computed(() =>
  candidates.value.some((other) => {
    const before = current(other)
    const after = draft.value[other] ?? new Set()
    return before.size !== after.size || [...after].some((i) => !before.has(i))
  }),
)

const describe = (slots: number[], total: number) => (slots.length === total ? 'all shared items' : slots.map((i) => bisSlotLabels[i]).join(', '))

// Spelled out before Apply, since linking overwrites the other job's progress on those items
const warnings = computed(() =>
  added.value.flatMap(({ other, slots }) => {
    const name = jobDisplayName(other)
    const lines: string[] = []
    const overwritten = slots.filter((i) => {
      const theirs = bis.statusOf(other, i)
      return theirs !== EquipmentStatus.RAID && theirs !== bis.statusOf(props.job, i)
    })
    if (overwritten.length)
      lines.push(`${name}: ${describe(overwritten, sharedSlots(props.job, other).length)} will be replaced with ${displayName.value}'s progress.`)

    const leaves = [...new Set(slots.flatMap((i) => bis.linkedOnSlot(other, i).filter((j) => j !== props.job && !bis.isLinked(props.job, j, i))))]
    if (leaves.length) lines.push(`${name}: those items will be unlinked from ${leaves.map(jobDisplayName).join(', ')}.`)
    return lines
  }),
)

async function onApply() {
  saving.value = true
  error.value = null
  try {
    await bis.saveLinks(props.job, Object.fromEntries(Object.entries(draft.value).map(([other, slots]) => [other, [...slots]])))
    open.value = false
  } catch (err) {
    error.value = `Couldn't save links: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    saving.value = false
  }
}
</script>

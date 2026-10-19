<template>
  <a-modal
    v-model:open="open"
    title="Import BiS from xivgear"
    :width="640"
    :ok-text="importCount ? `Import ${importCount} items` : 'Import'"
    :ok-button-props="{ disabled: !importCount }"
    :confirm-loading="saving"
    @ok="onImport"
  >
    <p class="mb-3 text-sm text-gray-400">
      Paste a set or sheet link from xivgear.app. Each item becomes that slot's BiS piece: progress is kept where the piece stays the same.
      <template v-if="gearSet">Importing into {{ gearSet.name }}; items from any tier are kept.</template>
    </p>

    <a-input-search v-model:value="link" placeholder="https://xivgear.app/sl/…" enter-button="Load" :loading="loading" allow-clear @search="load" />
    <a-alert v-if="loadError" type="error" :message="loadError" show-icon class="mt-3" />

    <template v-if="sheet">
      <div class="mt-4 flex flex-wrap gap-3">
        <a-select v-if="sheet.sets.length > 1" v-model:value="setIndex" class="min-w-0 flex-1" :options="setOptions" />
        <a-select v-model:value="job" class="w-48" show-search :filter-option="filterJob" placeholder="Job" :options="jobOptions">
          <template #option="{ value, label }">
            <span class="inline-flex items-center gap-2">
              <img :src="`/job/${value}.png`" alt="" class="size-4" />
              {{ label }}
            </span>
          </template>
        </a-select>
      </div>
      <a-typography-text v-if="job && set?.job && job !== set.job" type="warning" class="mt-1 block text-xs">
        This set is for {{ jobDisplayName(set.job) }}. Items {{ jobDisplayName(job) }} can't wear won't be recognised.
      </a-typography-text>

      <a-list v-if="job" size="small" class="mt-3" bordered>
        <a-list-item v-for="row in rows" :key="row.slot">
          <a-list-item-meta>
            <template #avatar>
              <a-avatar :src="row.icon" shape="square" :size="32" :class="row.kind !== 'piece' && 'opacity-40'" />
            </template>
            <template #title>
              <span class="text-xs text-gray-500">{{ bisSlotLabels[row.slot] }}</span>
            </template>
            <template #description>
              <span :class="row.kind === 'piece' ? 'text-gray-200' : 'text-gray-500'">{{ row.name }}</span>
            </template>
          </a-list-item-meta>

          <template v-if="row.kind === 'piece'">
            <span v-if="row.from === row.to" class="text-xs text-gray-500">{{ equipmentStatuses[row.to].label }}, unchanged</span>
            <span v-else class="inline-flex items-center gap-1.5 text-xs">
              <span class="text-gray-500">{{ equipmentStatuses[row.from].label }}</span>
              <arrow-right-outlined class="text-gray-500" />
              <a-tag color="blue" class="m-0!">{{ equipmentStatuses[row.to].label }}</a-tag>
            </span>
          </template>
          <a-tooltip
            v-else
            :title="
              row.kind === 'empty'
                ? 'Empty in this set'
                : 'Not this tier\'s raid or tome piece, so it isn\'t tracked. Import it into a custom gear set to track it'
            "
          >
            <span class="text-xs text-gray-500">Left as is</span>
          </a-tooltip>
        </a-list-item>
      </a-list>

      <a-alert v-if="warnings.length" type="warning" show-icon class="mt-3">
        <template #message>
          <ul class="m-0 list-none p-0">
            <li v-for="w in warnings" :key="w">{{ w }}</li>
          </ul>
        </template>
      </a-alert>
    </template>

    <a-alert v-if="saveError" type="error" :message="saveError" show-icon class="mt-3" />
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { ArrowRightOutlined } from '@ant-design/icons-vue'
import { EquipmentStatus } from '@/types/EquipmentType'
import { bisSlotLabels, bisSlots } from '@/constants/bisSlots'
import { equipmentStatuses } from '@/constants/equipmentStatus'
import { equipmentIcons, gearPiece } from '@/constants/icons'
import { jobDisplayName, jobsByRole } from '@/constants/jobs'
import { fetchItemNames, fetchXivgearSheet, guessSource, importedStatus, slotImports, startingStatus, type ImportedSheet } from '@/api/xivgear'
import { useBisStore } from '@/stores/bisStore'
import { useGearSetsStore } from '@/stores/gearSetsStore'
import { useItemCatalogStore } from '@/stores/itemCatalogStore'

// The gear set to import into: 0 is the default one (this tier's raid and tome pieces only), anything else a custom set
const props = defineProps<{ setId: number }>()
const open = defineModel<boolean>('open', { required: true })

const bis = useBisStore(props.setId)
const gearSets = useGearSetsStore()
const gearSet = computed(() => (props.setId ? gearSets.byId(props.setId) : undefined))
const catalog = useItemCatalogStore()
const router = useRouter()

const link = ref('')
const loading = ref(false)
const loadError = ref<string | null>(null)
const sheet = ref<ImportedSheet | null>(null)
const setIndex = ref(0)
const job = ref<string | undefined>()
// Names of items outside this tier's raid/tome gear, so the preview can say what they are
const otherNames = ref<Record<number, string>>({})
const saving = ref(false)
const saveError = ref<string | null>(null)

// Start clean each time, so an old preview isn't imported by accident
watch(open, (isOpen) => {
  if (!isOpen) return
  link.value = ''
  sheet.value = null
  loadError.value = saveError.value = null
})

async function load() {
  if (!link.value.trim()) return
  loading.value = true
  loadError.value = null
  sheet.value = null
  try {
    const loaded = await fetchXivgearSheet(link.value)
    const ids = loaded.sets.flatMap((s) => s.itemIds.filter((id): id is number => id !== null))
    // A custom set keeps every item, so it needs their icons too; the default set only names the ones it skips
    if (gearSet.value) await catalog.ensureItems(ids)
    else otherNames.value = await fetchItemNames(ids)
    sheet.value = loaded
    setIndex.value = loaded.preferredIndex
    job.value = inSet(loaded.sets[loaded.preferredIndex]!.job)
  } catch (err) {
    loadError.value = `Couldn't load that set: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    loading.value = false
  }
}

const set = computed(() => sheet.value?.sets[setIndex.value])
const setOptions = computed(() => sheet.value?.sets.map((s, i) => ({ value: i, label: s.name })) ?? [])

// A sheet's sets can be for different jobs; follow the set unless it doesn't say
watch(set, (s) => {
  const j = inSet(s?.job)
  if (j) job.value = j
})

// Only the gear set's jobs can be imported into
const setJobs = computed(() => gearSet.value?.jobs ?? jobsByRole.flatMap((group) => group.jobs))
const inSet = (j: string | null | undefined) => (j && setJobs.value.includes(j) ? j : undefined)
const jobOptions = computed(() => setJobs.value.map((j) => ({ value: j, label: jobDisplayName(j) })))
const filterJob = (input: string, option: { label: string }) => option.label.toLowerCase().includes(input.toLowerCase())

// itemId: custom sets only, the item the slot gets pinned to
type PieceRow = { slot: number; kind: 'piece'; icon: string; name: string; from: EquipmentStatus; to: EquipmentStatus; itemId?: number }
type Row = PieceRow | { slot: number; kind: 'empty' | 'other'; icon: string; name: string; from: null; to: null }

// Custom sets take every item as it is, pinned to the slot. Progress is kept where the slot already shows that item.
function customRows(j: string, itemIds: readonly (number | null)[]): Row[] {
  const range = gearSet.value!
  return bisSlots.map((type, slot) => {
    const id = itemIds[slot]
    if (!id) return { slot, kind: 'empty', icon: equipmentIcons[type], name: 'Nothing', from: null, to: null }
    const item = catalog.items[id]
    const from = bis.statusOf(j, slot)
    const current = bis.itemOf(j, slot) ?? catalog.autoPiece(j, range.minIlvl, range.maxIlvl, type, bis.sourceOf(j, slot))?.id
    // The range's dungeon piece (the one at the encounter's item level) starts on Dungeon; the rest go by name
    const isDungeon = catalog.autoPiece(j, range.minIlvl, range.maxIlvl, type, 'dungeon')?.id === id
    const to = current === id ? from : startingStatus(isDungeon ? 'dungeon' : guessSource(item?.name))
    const name = item ? `${item.name} (i${item.ilvl})` : `Item ${id}`
    return { slot, kind: 'piece', icon: item?.icon ?? equipmentIcons[type], name, from, to, itemId: id }
  })
}

const rows = computed((): Row[] => {
  const j = job.value
  if (!j || !set.value) return []
  if (gearSet.value) return customRows(j, set.value.itemIds)
  return slotImports(j, set.value.itemIds).map((imp, slot) => {
    const type = bisSlots[slot]!
    if (imp.kind === 'piece') {
      const piece = gearPiece(j, type, imp.source)
      const from = bis.statusOf(j, slot)
      const to = importedStatus(from, bis.sourceOf(j, slot), imp.source)
      return { slot, kind: imp.kind, icon: piece.icon, name: piece.name ?? equipmentStatuses[to].label, from, to }
    }
    const name = imp.kind === 'empty' ? 'Nothing' : (otherNames.value[imp.itemId] ?? `Item ${imp.itemId}`)
    return { slot, kind: imp.kind, icon: equipmentIcons[type], name, from: null, to: null }
  })
})

const pieces = computed(() => rows.value.filter((r): r is PieceRow => r.kind === 'piece'))
const importCount = computed(() => pieces.value.length)

const warnings = computed(() => {
  const j = job.value
  if (!j) return []
  const lines: string[] = []

  // Linked slots change together, so a new piece here is a new piece there too
  const changedLinked = pieces.value.filter((r) => r.from !== r.to && bis.linkedOnSlot(j, r.slot).length)
  const byJob = new Map<string, string[]>()
  for (const r of changedLinked)
    for (const other of bis.linkedOnSlot(j, r.slot)) byJob.set(other, [...(byJob.get(other) ?? []), bisSlotLabels[r.slot]!])
  for (const [other, labels] of byJob) lines.push(`${jobDisplayName(other)} is linked on ${labels.join(', ')} and will change too.`)

  const lost = pieces.value.filter((r) => r.from !== r.to && r.from !== EquipmentStatus.RAID && r.from !== EquipmentStatus.TOME)
  if (lost.length) lines.push(`Progress on ${lost.map((r) => bisSlotLabels[r.slot]).join(', ')} is reset, since the BiS piece changes.`)

  if (!pieces.value.length && rows.value.length && !gearSet.value)
    lines.push("None of this set's items are this tier's raid or tome gear, so there's nothing to import.")
  return lines
})

async function onImport() {
  const j = job.value
  if (!j) return
  saving.value = true
  saveError.value = null
  try {
    const pinned = gearSet.value ? Object.fromEntries(pieces.value.map((r) => [r.slot, r.itemId!])) : undefined
    await bis.setStatuses(j, Object.fromEntries(pieces.value.map((r) => [r.slot, r.to])), pinned)
    message.success(`Imported ${jobDisplayName(j)}'s BiS`)
    open.value = false
    // Gear sets page scrolls to and highlights the card for ?job=
    router.push({ name: 'bisGear', query: { job: j, set: props.setId ? String(props.setId) : undefined } })
  } catch (err) {
    saveError.value = `Couldn't import: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    saving.value = false
  }
}
</script>

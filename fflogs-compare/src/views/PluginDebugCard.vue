<template>
  <!-- Everything the game plugin has sent (pluginStore's data), laid out to read, and what the app takes from it.
       Shown with the Settings debug option; reloads every 30 seconds while it's open. -->
  <a-card size="small" title="Game plugin debug">
    <template #extra>
      <a-button size="small" :loading="loading" @click="refresh">Refresh</a-button>
    </template>
    <a-typography-paragraph type="secondary" class="text-xs">
      Reloads every 30 seconds while it's open<template v-if="loadedAt">, last {{ formatTime(loadedAt) }}</template
      >. "Read" is when the plugin read it in the game, "received" when it got here.
    </a-typography-paragraph>

    <a-empty v-if="!data?.characters.length" :image="Empty.PRESENTED_IMAGE_SIMPLE" description="Nothing received yet" />
    <template v-else>
      <a-typography-title :level="5">What the app uses</a-typography-title>
      <a-typography-paragraph type="secondary" class="text-xs">
        From {{ plugin.characterName ?? 'the character heard from last' }}. Each new snapshot is copied in once; "Differs" means the value was changed
        in the app since.
      </a-typography-paragraph>
      <a-table :columns="fieldColumns" :data-source="fieldRows" :pagination="false" size="small" row-key="field" :scroll="{ x: 'max-content' }">
        <template #emptyText>Nothing: no inventory, and no weekly snapshot from this week</template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'current'">
            <a-typography-text v-if="record.current === undefined" type="secondary">Plugin only</a-typography-text>
            <span v-else>{{ record.current }}</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag v-if="record.current === undefined || record.current === record.value" color="cyan" class="me-0!">Plugin's</a-tag>
            <a-tag v-else color="orange" class="me-0!">Differs</a-tag>
          </template>
          <span v-else-if="column.key === 'capturedAt'" class="whitespace-nowrap">{{ formatTime(record.capturedAt) }}</span>
        </template>
      </a-table>

      <a-typography-title :level="5" class="mt-4!">Characters</a-typography-title>
      <a-collapse :default-active-key="[data.characters[0]!.contentId]">
        <a-collapse-panel v-for="(c, i) in data.characters" :key="c.contentId">
          <template #header>
            <span class="flex flex-wrap items-center gap-2">
              <span class="font-semibold">{{ c.snapshots.character?.data.name ?? 'Unnamed character' }}</span>
              <a-typography-text v-if="c.snapshots.character" type="secondary">{{ c.snapshots.character.data.world }}</a-typography-text>
              <a-tag v-if="i === 0" color="cyan" class="me-0!">Used by the app</a-tag>
            </span>
          </template>
          <a-typography-paragraph type="secondary" class="text-xs">Content id {{ c.contentId }}</a-typography-paragraph>

          <a-collapse ghost>
            <a-collapse-panel v-if="c.snapshots.character" key="character" header="Character">
              <template #extra
                ><span :class="timeClass">{{ snapshotTimes(c.snapshots.character) }}</span></template
              >
              <a-descriptions size="small" bordered :column="1">
                <a-descriptions-item label="Name">{{ c.snapshots.character.data.name }}</a-descriptions-item>
                <a-descriptions-item label="World">{{ c.snapshots.character.data.world }}</a-descriptions-item>
                <a-descriptions-item label="Data center">{{ c.snapshots.character.data.dataCenter ?? '—' }}</a-descriptions-item>
              </a-descriptions>
            </a-collapse-panel>

            <a-collapse-panel v-if="c.snapshots.jobs" key="jobs" header="Jobs">
              <template #extra
                ><span :class="timeClass">{{ snapshotTimes(c.snapshots.jobs) }}</span></template
              >
              <div class="mb-2">
                Current job: <a-tag color="cyan">{{ c.snapshots.jobs.data.current }}</a-tag>
              </div>
              <div class="flex flex-wrap gap-1">
                <a-tag v-for="(level, job) in c.snapshots.jobs.data.levels" :key="job" class="me-0!">{{ job }} {{ level }}</a-tag>
              </div>
            </a-collapse-panel>

            <a-collapse-panel v-if="c.snapshots.gear" key="gear" header="Equipped gear">
              <template #extra
                ><span :class="timeClass">{{ snapshotTimes(c.snapshots.gear) }}</span></template
              >
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <a-tag color="cyan" class="me-0!">{{ c.snapshots.gear.data.job }}</a-tag>
                <a-typography-text v-if="c.snapshots.gear.data.itemLevel" type="secondary">
                  Item level {{ c.snapshots.gear.data.itemLevel }}
                </a-typography-text>
              </div>
              <a-table v-bind="gearTable" :data-source="c.snapshots.gear.data.items">
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'slot'">{{ slotLabels[record.slot as PluginGearSlot] ?? record.slot }}</template>
                  <item-cell v-else-if="column.key === 'item'" :id="record.itemId" />
                  <template v-else-if="column.key === 'hq'">{{ record.hq ? 'HQ' : '' }}</template>
                  <template v-else-if="column.key === 'materia'">{{ materiaText(record.materia) }}</template>
                </template>
              </a-table>
            </a-collapse-panel>

            <a-collapse-panel v-if="c.snapshots.gearsets" key="gearsets" :header="`Gear sets (${c.snapshots.gearsets.data.sets.length})`">
              <template #extra
                ><span :class="timeClass">{{ snapshotTimes(c.snapshots.gearsets) }}</span></template
              >
              <a-collapse ghost>
                <a-collapse-panel v-for="set in sortedSets(c.snapshots.gearsets.data.sets)" :key="set.index">
                  <template #header>
                    <span class="flex flex-wrap items-center gap-2">
                      <span>#{{ set.index + 1 }} {{ set.name }}</span>
                      <a-tag class="me-0!">{{ set.job }}</a-tag>
                      <a-typography-text v-if="set.itemLevel" type="secondary">i{{ set.itemLevel }}</a-typography-text>
                    </span>
                  </template>
                  <a-table v-bind="gearTable" :data-source="set.items">
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.key === 'slot'">{{ slotLabels[record.slot as PluginGearSlot] ?? record.slot }}</template>
                      <item-cell v-else-if="column.key === 'item'" :id="record.itemId" />
                      <template v-else-if="column.key === 'hq'">{{ record.hq ? 'HQ' : '' }}</template>
                      <template v-else-if="column.key === 'materia'">{{ materiaText(record.materia) }}</template>
                    </template>
                  </a-table>
                </a-collapse-panel>
              </a-collapse>
            </a-collapse-panel>

            <a-collapse-panel v-if="c.snapshots.inventory" key="inventory" :header="`Inventory (${c.snapshots.inventory.data.items.length} items)`">
              <template #extra
                ><span :class="timeClass">{{ snapshotTimes(c.snapshots.inventory) }}</span></template
              >
              <a-input-search v-model:value="search" placeholder="Search by name or id" allow-clear class="mb-2 max-w-72" />
              <a-table
                :columns="inventoryColumns"
                :data-source="inventoryRows(c)"
                :pagination="{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }"
                size="small"
                row-key="itemId"
                :scroll="{ x: 'max-content' }"
              >
                <template #bodyCell="{ column, record }">
                  <item-cell v-if="column.key === 'item'" :id="record.itemId" />
                  <a-tag v-else-if="column.key === 'use' && record.use" color="cyan" class="me-0!">{{ record.use }}</a-tag>
                </template>
              </a-table>
            </a-collapse-panel>

            <a-collapse-panel v-if="c.snapshots.weekly" key="weekly">
              <template #header>
                <span class="flex flex-wrap items-center gap-2">
                  <span>Weekly</span>
                  <a-tag v-if="i === 0 && !plugin.weekly" color="orange" class="me-0!">From before this week's reset: not used</a-tag>
                </span>
              </template>
              <template #extra
                ><span :class="timeClass">{{ snapshotTimes(c.snapshots.weekly) }}</span></template
              >
              <a-descriptions size="small" bordered :column="1" class="mb-3">
                <a-descriptions-item label="Tomestones">
                  <template v-if="c.snapshots.weekly.data.tomestones">
                    {{ c.snapshots.weekly.data.tomestones.earned }} / {{ c.snapshots.weekly.data.tomestones.cap }} earned
                    <a-typography-text type="secondary"
                      >({{ itemName(c.snapshots.weekly.data.tomestones.itemId ?? TOME_ITEM_ID) }})</a-typography-text
                    >
                  </template>
                  <a-typography-text v-else type="secondary">Not sent</a-typography-text>
                </a-descriptions-item>
                <a-descriptions-item label="Wondrous Tails">
                  <template v-if="c.snapshots.weekly.data.wondrousTails">
                    {{ c.snapshots.weekly.data.wondrousTails.stickers }} / 9 seals,
                    {{ c.snapshots.weekly.data.wondrousTails.secondChancePoints }} second chance points
                  </template>
                  <a-typography-text v-else type="secondary">Not sent</a-typography-text>
                </a-descriptions-item>
                <a-descriptions-item label="Custom Deliveries">
                  <template v-if="c.snapshots.weekly.data.customDeliveries">
                    {{ c.snapshots.weekly.data.customDeliveries.allowancesLeft }} allowances left
                  </template>
                  <a-typography-text v-else type="secondary">Not sent</a-typography-text>
                </a-descriptions-item>
              </a-descriptions>
              <a-table
                :columns="activityColumns"
                :data-source="activityRows(c.snapshots.weekly.data.activities)"
                :pagination="false"
                size="small"
                row-key="id"
                :scroll="{ x: 'max-content' }"
              >
                <template #emptyText>No activities sent</template>
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'name'">
                    <span v-if="record.name">{{ record.name }}</span>
                    <a-typography-text v-else type="warning">Unknown activity: ignored</a-typography-text>
                  </template>
                </template>
              </a-table>
            </a-collapse-panel>
          </a-collapse>
        </a-collapse-panel>
      </a-collapse>
    </template>

    <template v-if="data?.events.length">
      <a-typography-title :level="5" class="mt-4!">Events ({{ data.events.length }})</a-typography-title>
      <a-table
        :columns="eventColumns"
        :data-source="eventRows"
        :pagination="{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }"
        size="small"
        row-key="key"
        :scroll="{ x: 'max-content' }"
      >
        <template #bodyCell="{ column, record }">
          <span v-if="column.key === 'occurredAt'" class="whitespace-nowrap">{{ formatTime(record.occurredAt) }}</span>
          <a-tag v-else-if="column.key === 'type'" class="me-0!">{{ record.type }}</a-tag>
        </template>
      </a-table>
    </template>

    <a-collapse v-if="data" ghost class="mt-4">
      <a-collapse-panel key="raw" header="Raw data (JSON)">
        <a-typography-paragraph :copyable="{ text: rawJson }" class="mb-1! text-xs">Copy</a-typography-paragraph>
        <pre class="max-h-96 overflow-auto text-xs">{{ rawJson }}</pre>
      </a-collapse-panel>
    </a-collapse>
  </a-card>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { Empty, TypographyText, type TableColumnType } from 'ant-design-vue'
import { storeToRefs } from 'pinia'
import { cofferDefs } from '@/constants/coffers'
import { gearItemNames } from '@/constants/gearItems'
import { raidFloors, upgradeItemIds, type RaidFloor } from '@/constants/raidFloors'
import { TOME_ITEM_ID } from '@/constants/tomeCosts'
import { weeklyActivities } from '@/constants/weeklyActivities'
import { usePluginStore } from '@/stores/pluginStore'
import { useStockStore } from '@/stores/stockStore'
import { useWeeklyStore } from '@/stores/weeklyStore'
import type { EquipmentType } from '@/types/EquipmentType'
import type { PluginData, PluginGearItem, PluginGearSlot, PluginSnapshots } from '@/types/plugin'

const RELOAD_MS = 30_000

const plugin = usePluginStore()
const { data } = storeToRefs(plugin)
const stockStore = useStockStore()
const weeklyStore = useWeeklyStore()

type Character = PluginData['characters'][number]

// --- Reloading ---

const loading = ref(false)
const loadedAt = ref<number>()
const now = ref(Date.now())

async function refresh() {
  loading.value = true
  await plugin.load()
  loading.value = false
  loadedAt.value = now.value = Date.now()
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void refresh()
  timer = setInterval(() => {
    now.value = Date.now()
    if (document.visibilityState === 'visible') void refresh()
  }, RELOAD_MS)
})
onUnmounted(() => clearInterval(timer))

// --- Times ---

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const units = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
] as const

function ago(ms: number) {
  const seconds = (ms - now.value) / 1000
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return rtf.format(Math.trunc(seconds / size), unit)
  return rtf.format(Math.trunc(seconds), 'second')
}

const formatTime = (ms: number) => `${new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })} (${ago(ms)})`
const snapshotTimes = (s: { capturedAt: number; receivedAt: number }) => `read ${ago(s.capturedAt)}, received ${ago(s.receivedAt)}`
const timeClass = 'text-xs opacity-60'

// --- Item names, from XIVAPI ---

const names = ref<Record<number, string>>({})
const requested = new Set<number>()
// XIVAPI takes this many rows a request
const NAME_BATCH = 100

const gearIds = (items: PluginGearItem[]) => items.flatMap((i) => [i.itemId, ...i.materia])
const itemIds = computed(() =>
  (data.value?.characters ?? []).flatMap((c) => {
    const s = c.snapshots
    return [
      ...(s.inventory?.data.items.map((i) => i.itemId) ?? []),
      ...gearIds(s.gear?.data.items ?? []),
      ...(s.gearsets?.data.sets.flatMap((set) => gearIds(set.items)) ?? []),
      s.weekly?.data.tomestones?.itemId ?? TOME_ITEM_ID,
      ...(data.value?.events.flatMap((e) => (e.type === 'loot' ? [e.data.itemId] : [])) ?? []),
    ]
  }),
)

// Best effort: an item without a name shows its id
async function fetchNames(ids: number[]) {
  for (let start = 0; start < ids.length; start += NAME_BATCH) {
    try {
      const params = new URLSearchParams({ rows: ids.slice(start, start + NAME_BATCH).join(','), fields: 'Name' })
      const res = await fetch(`https://v2.xivapi.com/api/sheet/Item?${params}`)
      if (!res.ok) continue
      const body = (await res.json()) as { rows: { row_id: number; fields: { Name: string } }[] }
      for (const r of body.rows) if (r.fields.Name) names.value[r.row_id] = r.fields.Name
    } catch {
      // Left without a name
    }
  }
}

watch(
  itemIds,
  (ids) => {
    const unknown = [...new Set(ids)].filter((id) => id > 0 && !requested.has(id))
    unknown.forEach((id) => requested.add(id))
    if (unknown.length) void fetchNames(unknown)
  },
  { immediate: true },
)

const itemName = (id: number) => names.value[id] ?? gearItemNames[id] ?? `Item ${id}`
const materiaText = (materia: number[]) => materia.map(itemName).join(', ')

// An item's name, with its id beside it
const ItemCell = defineComponent({
  props: { id: { type: Number, required: true } },
  setup: (props) => () =>
    h('span', { class: 'whitespace-nowrap' }, [
      itemName(props.id),
      ' ',
      h(TypographyText, { type: 'secondary', class: 'text-xs' }, () => `#${props.id}`),
    ]),
})

// --- What the app uses ---

const fieldLabels: Record<string, string> = {
  tomes: 'Tomestones held',
  tomesEarnedThisWeek: 'Tomestones earned this week',
  twines: 'Twines',
  glazes: 'Glazes',
  'wondrousTails.stickers': 'Wondrous Tails seals',
  'wondrousTails.secondChancePoints': 'Wondrous Tails second chance points',
}

function fieldLabel(field: string) {
  if (fieldLabels[field]) return fieldLabels[field]
  const [group, key] = field.split('.') as [string, string]
  if (group === 'books') return `Floor ${key} books`
  if (group === 'coffers') return `${cofferDefs.find((c) => String(c.type) === key)?.label ?? key} coffers`
  if (group === 'weekly') return `Weekly: ${weeklyActivities.find((a) => a.id === key)?.name ?? key}`
  return field
}

// What the app shows for the field now; undefined for the ones only the plugin gives
function currentValue(field: string): number | undefined {
  const stock = stockStore.stock
  const [group, key] = field.split('.') as [string, string]
  if (group === 'books') return stock.books[Number(key) as RaidFloor]
  if (group === 'coffers') return stock.coffers[Number(key) as EquipmentType]
  if (group === 'weekly') return weeklyStore.doneCount(key)
  if (group === 'wondrousTails') return undefined
  return stock[field as 'tomes' | 'tomesEarnedThisWeek' | 'twines' | 'glazes']
}

const fieldRows = computed(() =>
  [...plugin.fields].map(([field, { value, capturedAt }]) => ({ field, label: fieldLabel(field), value, current: currentValue(field), capturedAt })),
)

const fieldColumns: TableColumnType[] = [
  { key: 'label', dataIndex: 'label', title: 'Field' },
  { key: 'field', dataIndex: 'field', title: 'Key' },
  { key: 'value', dataIndex: 'value', title: 'Plugin', align: 'right' },
  { key: 'current', title: 'App now', align: 'right' },
  { key: 'status', title: '' },
  { key: 'capturedAt', title: 'Read' },
]

// --- Gear ---

const slotLabels: Record<PluginGearSlot, string> = {
  mainHand: 'Main hand',
  offHand: 'Off hand',
  head: 'Head',
  body: 'Body',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
  earrings: 'Earrings',
  necklace: 'Necklace',
  bracelets: 'Bracelets',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
  soulCrystal: 'Soul crystal',
}

const gearTable = {
  columns: [
    { key: 'slot', title: 'Slot' },
    { key: 'item', title: 'Item' },
    { key: 'hq', title: 'HQ' },
    { key: 'materia', title: 'Materia' },
  ] satisfies TableColumnType[],
  pagination: false as const,
  size: 'small' as const,
  rowKey: 'slot',
  scroll: { x: 'max-content' },
}

const sortedSets = (sets: PluginSnapshots['gearsets']['sets']) => [...sets].sort((a, b) => a.index - b.index)

// --- Inventory ---

const search = ref('')

// The items the app counts, and as what
const itemUses = new Map<number, string>([
  ...raidFloors.map((f): [number, string] => [f.bookItemId, `${f.label} books`]),
  ...cofferDefs.map((c): [number, string] => [c.itemId, `${c.label} coffers`]),
  [upgradeItemIds.twine, 'Twines'],
  [upgradeItemIds.glaze, 'Glazes'],
])

// The ones the app counts first, then by name
function inventoryRows(c: Character) {
  const tomeId = c.snapshots.weekly?.data.tomestones?.itemId ?? TOME_ITEM_ID
  const query = search.value.trim().toLowerCase()
  return (c.snapshots.inventory?.data.items ?? [])
    .map((i) => ({ ...i, name: itemName(i.itemId), use: i.itemId === tomeId ? 'Tomestones' : itemUses.get(i.itemId) }))
    .filter((i) => !query || i.name.toLowerCase().includes(query) || String(i.itemId).includes(query))
    .sort((a, b) => Number(!a.use) - Number(!b.use) || a.name.localeCompare(b.name))
}

const inventoryColumns: TableColumnType[] = [
  { key: 'item', title: 'Item' },
  { key: 'count', dataIndex: 'count', title: 'Count', align: 'right' },
  { key: 'use', title: 'Counted as' },
]

// --- Weekly ---

const activityRows = (activities: Record<string, number> | undefined) =>
  Object.entries(activities ?? {}).map(([id, value]) => ({ id, value, name: weeklyActivities.find((a) => a.id === id)?.name }))

const activityColumns: TableColumnType[] = [
  { key: 'name', title: 'Activity' },
  { key: 'id', dataIndex: 'id', title: 'Id' },
  { key: 'value', dataIndex: 'value', title: 'Value', align: 'right' },
]

// --- Events ---

const formatDuration = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

const eventRows = computed(() => {
  const characterNames = new Map(data.value?.characters.map((c) => [c.contentId, c.snapshots.character?.data.name ?? c.contentId]))
  return (data.value?.events ?? []).map((e, index) => ({
    key: index,
    occurredAt: e.occurredAt,
    character: characterNames.get(e.characterId) ?? e.characterId,
    type: e.type === 'dutyCompleted' ? 'Duty completed' : 'Loot',
    details:
      e.type === 'dutyCompleted'
        ? [e.data.name, e.data.durationMs !== undefined && `in ${formatDuration(e.data.durationMs)}`, `territory ${e.data.territoryId}`]
            .filter(Boolean)
            .join(', ')
        : `${e.data.count} × ${itemName(e.data.itemId)}${e.data.hq ? ' (HQ)' : ''}${e.data.dutyName ? `, in ${e.data.dutyName}` : ''}`,
  }))
})

const eventColumns: TableColumnType[] = [
  { key: 'occurredAt', title: 'When' },
  { key: 'character', dataIndex: 'character', title: 'Character' },
  { key: 'type', title: 'Type' },
  { key: 'details', dataIndex: 'details', title: 'Details' },
]

const rawJson = computed(() => JSON.stringify(data.value, null, 2))
</script>

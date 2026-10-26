<template>
  <!-- One tab per relic series, oldest first; the newest opens by default -->
  <a-tabs :active-key="active.key" @change="select">
    <a-tab-pane v-for="s in relicSeries" :key="s.key">
      <template #tab>
        {{ s.name }}
        <a-typography-text type="secondary" class="ml-1 text-xs">{{ s.expansion }}</a-typography-text>
        <!-- Room for the tick is always kept, so a series finishing doesn't push the other tabs along -->
        <check-icon class="ml-1 inline size-4 align-[-3px]" :class="!relics.isSeriesComplete(s) && 'invisible'" />
      </template>
    </a-tab-pane>
  </a-tabs>

  <a-card size="small" class="mb-3!" :body-style="{ padding: '14px 20px' }">
    <div class="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div class="flex items-center gap-3">
        <a-progress type="circle" :percent="summary.percent" :size="48" :stroke-width="9" />
        <div>
          <a-typography-text type="secondary" class="block text-xs">{{ active.name }} progress</a-typography-text>
          <span class="inline-block text-lg font-semibold tabular-nums" :style="widthFor(`${summary.total} / ${summary.total}`)">
            {{ summary.done }} / {{ summary.total }}
          </span>
          <a-typography-text type="secondary" class="ml-1 text-xs">stages</a-typography-text>
        </div>
      </div>
      <a-divider type="vertical" class="h-10! max-sm:hidden" />
      <div>
        <a-typography-text type="secondary" class="block text-xs">Finished weapons</a-typography-text>
        <span class="inline-block text-lg font-semibold tabular-nums" :style="widthFor(`${active.jobs.length} / ${active.jobs.length}`)">
          {{ summary.finished }} / {{ active.jobs.length }}
        </span>
        <a-typography-text type="secondary" class="ml-1 text-xs">jobs</a-typography-text>
      </div>
      <!-- What the stages still to do cost, per currency, like the gear sets' materials needed; hover for the jobs behind it -->
      <template v-for="c in costTotals" :key="c.currency">
        <a-divider type="vertical" class="h-10! max-sm:hidden" />
        <a-tooltip placement="bottom">
          <template #title>
            <div class="font-semibold">{{ c.spent.toLocaleString() }} spent so far</div>
            <div v-if="c.held" class="font-semibold">{{ c.held.toLocaleString() }} already held as stage items</div>
            <div class="mt-1 text-xs text-gray-400">{{ c.held ? 'Per job, before held items' : 'Per job' }}</div>
            <div v-for="j in c.jobs" :key="j.job" class="flex justify-between gap-6 tabular-nums">
              <span>{{ jobDisplayName(j.job) }}</span>
              <span>{{ j.needed.toLocaleString() }}</span>
            </div>
          </template>
          <div class="flex cursor-default items-center gap-3">
            <a-avatar :src="currencyIcons[c.currency]" shape="square" :size="40" class="bg-gray-800! p-1.5" />
            <div>
              <a-typography-text type="secondary" class="block text-xs">{{ c.currency }} needed</a-typography-text>
              <span
                class="inline-block text-lg font-semibold tabular-nums"
                :class="c.needed === 0 ? 'text-green-400' : ''"
                :style="widthFor(c.most.toLocaleString())"
              >
                {{ c.needed.toLocaleString() }}
              </span>
            </div>
          </div>
        </a-tooltip>
        <!-- Hunt trains and S ranks pay these tomestones; it shrinks to the room left on the line rather than wrap -->
        <hunt-tomes-estimate :currency="c.currency" :needed="c.needed" />
      </template>
    </div>
  </a-card>

  <!-- Stages are done in order: finishing one finishes everything before it, undoing one undoes everything after it.
       Each stage looks like a BiS card's slot: the job's weapon at that stage, green with a tick once it's done. -->
  <a-table
    :data-source="rows"
    :columns="columns"
    row-key="job"
    size="small"
    :pagination="false"
    :scroll="{ x: 'max-content' }"
    class="thin-scroll-table"
  >
    <!-- Under a stage's name: how many jobs have it (with a box ticking or unticking it for every job), then its cost per weapon -->
    <template #headerCell="{ column }">
      <template v-if="column.stages">
        <span class="block whitespace-nowrap">{{ column.title }}</span>
        <div class="flex items-center justify-center gap-1.5">
          <a-tooltip :title="columnAllDone(column.stages) ? 'Undo for every job' : 'Mark done for every job'" :mouse-enter-delay="0.4">
            <a-checkbox
              :checked="columnAllDone(column.stages)"
              :indeterminate="!columnAllDone(column.stages) && columnAnyDone(column.stages)"
              :aria-label="`${column.title} for every job`"
              @change="toggleColumn(column.stages)"
            />
          </a-tooltip>
          <span class="text-xs font-normal whitespace-nowrap text-gray-400 tabular-nums">{{ stageCounts(column.stages) }}</span>
        </div>
      </template>
      <template v-if="column.cost">
        <span class="inline-flex items-center gap-1 text-xs font-normal text-gray-400 tabular-nums">
          <img :src="costIcon(column.cost)" :alt="column.cost.currency" class="size-4" />
          {{ column.cost.amount.toLocaleString() }}
        </span>
        <!-- Items held for this stage (any job's weapon takes them); ticking a weapon uses them up -->
        <a-tooltip v-if="column.cost.via" :title="stonesHint(column.cost.via, column.stage)">
          <div class="mt-1 flex items-center justify-center gap-1 text-xs font-normal text-gray-400">
            <a-input-number
              size="small"
              class="w-14!"
              :min="0"
              :max="MAX_STONES"
              :precision="0"
              :value="relics.stonesHeld(active, column.stage)"
              :aria-label="`${column.cost.via.item} held`"
              @change="(value: number | string | null) => relics.setStonesHeld(active, column.stage, Number(value ?? 0))"
            />
            <span class="whitespace-nowrap tabular-nums">/ {{ column.cost.via.perWeapon }}</span>
          </div>
        </a-tooltip>
      </template>
    </template>

    <template #bodyCell="{ column, record }">
      <a-space v-if="column.key === 'job'" :size="8" class="whitespace-nowrap">
        <a-avatar :src="jobIconPath(record.job)" shape="square" :size="24" />
        {{ jobDisplayName(record.job) }}
      </a-space>
      <!-- One slot per stage in the column (a joined stage sits next to the one it comes with), each clicked on its own -->
      <div v-else-if="column.stages" class="inline-flex gap-3 align-middle">
        <button
          v-for="stage in column.stages"
          :key="stage"
          type="button"
          class="relative size-10 cursor-pointer rounded-md border-2 transition hover:brightness-125"
          :class="record.done > stage ? doneClass : pendingClass"
          :aria-pressed="record.done > stage"
          :aria-label="`${jobDisplayName(record.job)} ${active.stages[stage]}`"
          @click="relics.toggleStage(active, record.job, stage)"
        >
          <!-- The generic relic icon until XIVAPI has answered, or if it couldn't -->
          <img :src="weaponOf(record.job, stage)?.icon ?? relicIcon" alt="" class="size-full rounded p-0.5" />
          <span
            v-if="record.done > stage"
            class="absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full bg-gray-900 p-0.5"
          >
            <check-icon class="size-full" />
          </span>
        </button>
      </div>
      <div v-else-if="column.key === 'progress'" class="flex items-center gap-2">
        <div class="w-24 shrink-0">
          <a-progress :percent="Math.round((record.done / active.stages.length) * 100)" :show-info="false" size="small" class="m-0!" />
        </div>
        <!-- Count and Done tag share one fixed slot, so finishing a weapon doesn't resize the column -->
        <div class="flex h-[22px] w-[4.5rem] shrink-0 items-center">
          <a-tag v-if="record.done === active.stages.length" color="success" class="m-0!">
            <template #icon><check-circle-filled /></template>
            Done
          </a-tag>
          <a-typography-text v-else type="secondary" class="text-xs whitespace-nowrap tabular-nums">
            {{ record.done }} / {{ active.stages.length }}
          </a-typography-text>
        </div>
      </div>
    </template>
  </a-table>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { TableColumnType } from 'ant-design-vue'
import { CheckCircleFilled } from '@ant-design/icons-vue'
import { relicSeries, type StageCost, type StageItem } from '@/constants/relicWeapons'
import { currencyIcons } from '@/constants/icons'
import { equipmentStatuses } from '@/constants/equipmentStatus'
import { EquipmentStatus } from '@/types/EquipmentType'
import relicIcon from '@/assets/relic.png'
import { jobDisplayName, jobsByRole } from '@/constants/jobs'
import { MAX_STONES, useRelicStore } from '@/stores/relicStore'
import HuntTomesEstimate from '@/views/hunts/HuntTomesEstimate.vue'
import { useItemCatalogStore } from '@/stores/itemCatalogStore'
import CheckIcon from './CheckIcon.vue'

const route = useRoute()
const router = useRouter()
const relics = useRelicStore()

const jobIconPath = (job: string) => `/job/${job}.png`
// The BiS card's slot borders: an unbought relic's grey, an acquired piece's green
const pendingClass = equipmentStatuses[EquipmentStatus.RELIC].className
const doneClass = equipmentStatuses[EquipmentStatus.ACQUIRED].className

// The open series lives in ?series=, so a refresh or a shared link reopens it; anything unknown is the newest one
const active = computed(() => relicSeries.find((s) => s.key === route.query.series) ?? relicSeries[relicSeries.length - 1]!)

// The open series' weapons, looked up on XIVAPI for their icons and names
const catalog = useItemCatalogStore()
watch(active, (series) => void catalog.ensureItems(Object.values(series.weapons).flat()), { immediate: true })

const weaponOf = (job: string, stage: number) => {
  const id = active.value.weapons[job]?.[stage]
  return id === undefined ? undefined : catalog.items[id]
}

function select(key: string | number) {
  router.replace({ query: { ...route.query, series: String(key) } })
}

// The series' jobs, in role order like the rest of the tracker
const rows = computed(() =>
  jobsByRole.flatMap((group) =>
    group.jobs.filter((job) => active.value.jobs.includes(job)).map((job) => ({ job, done: relics.stagesDone(active.value, job) })),
  ),
)

const summary = computed(() => {
  const total = active.value.jobs.length * active.value.stages.length
  const done = rows.value.reduce((sum, row) => sum + row.done, 0)
  return {
    done,
    total,
    percent: Math.round((done / total) * 100),
    finished: rows.value.filter((row) => row.done === active.value.stages.length).length,
  }
})

// A stage column's header count: jobs done with each of its stages, out of the series' jobs (a joined column shows both)
const stageCounts = (stages: number[]) =>
  stages.map((stage) => `${rows.value.filter((row) => row.done > stage).length} / ${rows.value.length}`).join(' · ')

// A column's header box: ticked once every job has all its stages, half-ticked while some job has any of them. Clicking
// it finishes the column for every job, or undoes it for every job when they all had it.
const columnAllDone = (stages: number[]) => rows.value.every((row) => row.done > stages[stages.length - 1]!)
const columnAnyDone = (stages: number[]) => rows.value.some((row) => row.done > stages[0]!)
const toggleColumn = (stages: number[]) =>
  relics.setStageForAll(
    active.value,
    stages[0]!,
    stages[stages.length - 1]!,
    !columnAllDone(stages),
    rows.value.map((row) => row.job),
  )

// A summary figure keeps the width of the widest it can get (tabular digits, so ch is one digit), so the blocks after
// it don't move as it changes
const widthFor = (widest: string) => ({ minWidth: `${widest.length}ch` })

// Header cells aren't typed with our column type, so the icon lookup goes through this
const costIcon = (cost: StageCost) => currencyIcons[cost.currency]

function stonesHint(via: StageItem, stage: number) {
  const held = relics.stonesHeld(active.value, stage)
  const weapons = Math.floor(held / via.perWeapon)
  return `${via.item} held: enough for ${weapons} weapon${weapons === 1 ? '' : 's'}. Each weapon takes ${via.perWeapon} (${via.each} ${active.value.costs?.[stage]?.currency} each); ticking one uses them up, unticking gives them back.`
}

// Per currency: what the stages not done yet cost (overall and per job, jobs with nothing left out) and what the done ones did.
// Stage items already held count as paid for, up to what the stage's unfinished weapons still take (`held`, in the currency);
// the per-job figures are before that, since held items aren't any one job's.
const costTotals = computed(() => {
  const totals = new Map<
    StageCost['currency'],
    { currency: StageCost['currency']; needed: number; spent: number; held: number; most: number; jobs: { job: string; needed: number }[] }
  >()
  for (const row of rows.value) {
    const neededByCurrency = new Map<StageCost['currency'], number>()
    active.value.costs?.forEach((cost, i) => {
      if (!cost) return
      const total = totals.get(cost.currency) ?? { currency: cost.currency, needed: 0, spent: 0, held: 0, most: 0, jobs: [] }
      totals.set(cost.currency, total)
      total.most += cost.amount
      if (row.done > i) total.spent += cost.amount
      else {
        total.needed += cost.amount
        neededByCurrency.set(cost.currency, (neededByCurrency.get(cost.currency) ?? 0) + cost.amount)
      }
    })
    for (const [currency, needed] of neededByCurrency) totals.get(currency)!.jobs.push({ job: row.job, needed })
  }
  active.value.costs?.forEach((cost, i) => {
    if (!cost?.via) return
    const unfinished = rows.value.filter((row) => row.done <= i).length
    const covered = Math.min(relics.stonesHeld(active.value, i), unfinished * cost.via.perWeapon) * cost.via.each
    const total = totals.get(cost.currency)!
    total.held += covered
    total.needed -= covered
  })
  return [...totals.values()]
})

// Stage columns carry their stages for the cells (the first, plus any joined to it), and the first one's index and
// cost (if known) for the header
type RelicColumn = TableColumnType & { stage?: number; stages?: number[]; cost?: StageCost }

// A column per stage, except joined stages, which go in the column before theirs
const stageColumns = computed(() => {
  const series = active.value
  const result: RelicColumn[] = []
  series.stages.forEach((stage, i) => {
    const previous = result[result.length - 1]
    if (previous && series.joinedStages?.includes(i)) {
      previous.stages!.push(i)
      previous.title = `${previous.title} / ${stage}`
    } else result.push({ key: `stage${i}`, title: stage, stage: i, stages: [i], cost: series.costs?.[i], align: 'center' })
  })
  return result
})

const columns = computed<RelicColumn[]>(() => [
  { key: 'job', title: 'Job', fixed: 'left' },
  ...stageColumns.value,
  { key: 'progress', title: 'Progress', fixed: 'right' },
])
</script>

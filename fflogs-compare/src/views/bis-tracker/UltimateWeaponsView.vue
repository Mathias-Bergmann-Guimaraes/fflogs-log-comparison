<template>
  <a-card size="small" class="mb-3!" :body-style="{ padding: '14px 20px' }">
    <div class="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div class="flex items-center gap-3">
        <a-progress type="circle" :percent="summary.percent" :size="48" :stroke-width="9" />
        <div>
          <a-typography-text type="secondary" class="block text-xs">Ultimate weapons</a-typography-text>
          <span class="inline-block text-lg font-semibold tabular-nums" :style="widthFor(`${summary.total} / ${summary.total}`)">
            {{ summary.done }} / {{ summary.total }}
          </span>
          <a-typography-text type="secondary" class="ml-1 text-xs">weapons</a-typography-text>
        </div>
      </div>
      <a-divider type="vertical" class="h-10! max-sm:hidden" />
      <div>
        <a-typography-text type="secondary" class="block text-xs">Completed ultimates</a-typography-text>
        <span class="inline-block text-lg font-semibold tabular-nums" :style="widthFor(`${ultimateRaids.length} / ${ultimateRaids.length}`)">
          {{ summary.raidsComplete }} / {{ ultimateRaids.length }}
        </span>
        <a-typography-text type="secondary" class="ml-1 text-xs">every job</a-typography-text>
      </div>
      <a-divider type="vertical" class="h-10! max-sm:hidden" />
      <div>
        <a-typography-text type="secondary" class="block text-xs">Completed jobs</a-typography-text>
        <span class="inline-block text-lg font-semibold tabular-nums" :style="widthFor(`${rows.length} / ${rows.length}`)">
          {{ summary.jobsComplete }} / {{ rows.length }}
        </span>
        <a-typography-text type="secondary" class="ml-1 text-xs">every ultimate</a-typography-text>
      </div>
      <!-- Syncing the profile's FF Logs character's clears; the page also does it on opening, at most hourly -->
      <a-tooltip v-if="hasFFLogsCredentials && ultimates.character">
        <template #title>
          <div>Add the totems from new clears of {{ characterLabel(ultimates.character) }} on FF Logs.</div>
          <div class="mt-1 text-xs text-gray-400">
            {{ ultimates.syncedAt ? `Last synced ${new Date(ultimates.syncedAt).toLocaleString()}` : 'Not synced yet' }}. Only public logs count; the
            character is set in your profile.
          </div>
        </template>
        <a-button size="small" :loading="ultimates.syncing" @click="sync(false)">
          <template #icon><sync-outlined /></template>
          Sync clears
        </a-button>
      </a-tooltip>
    </div>
  </a-card>

  <!-- Each clear drops a totem: the profile's FF Logs character's clears say how many were earned. Only asked for while
       there's none (then the summary card syncs). Needs the FF Logs API credentials. -->
  <a-card v-if="hasFFLogsCredentials && !ultimates.character" size="small" class="mb-3!" :body-style="{ padding: '18px 24px' }">
    <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
      <a-typography-text strong>FF Logs clears</a-typography-text>
      <a-typography-text type="secondary">Claim your character in your profile to count totems from your clears on FF Logs.</a-typography-text>
      <a-button type="primary" size="small" @click="profile.modalOpen = true">
        <template #icon><user-outlined /></template>
        Claim a character
      </a-button>
    </div>
    <a-typography-text type="secondary" class="mt-3 block text-xs">
      Each clear drops a totem. The first sync makes sure you hold at least your clears minus the weapons you own; later syncs add only new clears, so
      totems you take off by hand (lost, discarded) stay off. Only public logs count.
    </a-typography-text>
  </a-card>

  <!-- One card per ultimate, in the table's column order: weapons had, totems held (typed in in the table), and with a profile FF Logs
       character its logged kills and best parse at the last sync -->
  <div class="mb-3 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
    <!-- Every job's weapon had: green, like a finished BiS card -->
    <a-card
      v-for="raid in ultimateRaids"
      :key="raid.key"
      size="small"
      :body-style="{ padding: '12px 16px' }"
      :class="ultimates.countFor(raid) === raid.jobs.length && 'border-green-500! shadow-[0_0_12px_rgba(34,197,94,0.3)]'"
    >
      <div class="flex items-center justify-between gap-2">
        <a-tooltip :title="`${raid.name} (${raid.expansion})`">
          <a-typography-text strong class="cursor-default">{{ raid.short }}</a-typography-text>
        </a-tooltip>
        <span class="inline-flex items-center gap-1 text-xs text-gray-400 tabular-nums">
          <check-icon v-if="ultimates.countFor(raid) === raid.jobs.length" class="size-3.5" />
          {{ ultimates.countFor(raid) }} / {{ raid.jobs.length }} weapons
        </span>
      </div>
      <a-progress :percent="Math.round((ultimates.countFor(raid) / raid.jobs.length) * 100)" :show-info="false" size="small" class="mt-1! mb-2!" />

      <div class="flex flex-col gap-1.5 text-xs">
        <!-- Held totems, typed in under the ultimate's column in the table -->
        <div class="flex items-center justify-between gap-2">
          <a-typography-text type="secondary" class="inline-flex items-center gap-1.5 text-xs">
            <img :src="totemIcon(raid)" alt="" class="size-5" />
            Totems
          </a-typography-text>
          <a-tooltip :title="totemHint(raid)">
            <span class="cursor-default font-semibold tabular-nums">{{ ultimates.totemsHeld(raid) }}</span>
          </a-tooltip>
        </div>
        <template v-if="ultimates.character">
          <div class="flex items-center justify-between gap-2">
            <a-typography-text type="secondary" class="text-xs">Logged kills</a-typography-text>
            <a-tooltip :title="killsHint(raid)">
              <span class="cursor-default font-semibold tabular-nums">{{ ultimates.loggedClears(raid) ?? '–' }}</span>
            </a-tooltip>
          </div>
          <div class="flex h-6 items-center justify-between gap-2">
            <a-typography-text type="secondary" class="text-xs">Best parse</a-typography-text>
            <!-- In FF Logs' colours, with the job it was on; opens the log -->
            <a-tooltip v-if="ultimates.bestLog(raid)" :title="bestHint(ultimates.bestLog(raid)!)">
              <a
                :href="logUrl(ultimates.bestLog(raid)!)"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1 font-semibold tabular-nums hover:underline"
                :style="{ color: parseColor(ultimates.bestLog(raid)!.percent) }"
              >
                <img :src="jobIconPath(ultimates.bestLog(raid)!.spec)" alt="" class="size-4" />
                {{ Math.floor(ultimates.bestLog(raid)!.percent) }}
              </a>
            </a-tooltip>
            <a-typography-text v-else type="secondary" class="text-xs">{{
              ultimates.loggedClears(raid) === undefined ? '–' : 'None ranked'
            }}</a-typography-text>
          </div>
        </template>
      </div>
    </a-card>
  </div>

  <!-- A column per ultimate, oldest first. Each weapon is ticked on its own; jobs that came after an ultimate have none. -->
  <a-table
    :data-source="rows"
    :columns="columns"
    row-key="job"
    size="small"
    :pagination="false"
    :scroll="{ x: 'max-content' }"
    class="thin-scroll-table"
  >
    <!-- An ultimate's short name, with its full name and expansion on hover and how many of its weapons are had under it;
         and the totems held, typed in here. The rest is in its card above. -->
    <template #headerCell="{ column }">
      <template v-if="column.raid">
        <a-tooltip :title="`${column.raid.name} (${column.raid.expansion})`">
          <span class="block whitespace-nowrap">{{ column.raid.short }}</span>
        </a-tooltip>
        <!-- A box ticking or unticking the ultimate's weapon for every job -->
        <div class="flex items-center justify-center gap-1.5">
          <a-tooltip :title="raidAllHad(column.raid) ? 'Undo for every job' : 'Mark had for every job'" :mouse-enter-delay="0.4">
            <a-checkbox
              :checked="raidAllHad(column.raid)"
              :indeterminate="!raidAllHad(column.raid) && ultimates.countFor(column.raid) > 0"
              :aria-label="`${column.raid.short} weapon for every job`"
              @change="toggleRaid(column.raid)"
            />
          </a-tooltip>
          <span class="inline-flex items-center gap-1 text-xs font-normal text-gray-400 tabular-nums">
            <check-icon v-if="raidAllHad(column.raid)" class="size-3.5" />
            {{ ultimates.countFor(column.raid) }} / {{ column.raid.jobs.length }}
          </span>
        </div>
        <!-- Totems held for this ultimate (any job's weapon takes one); ticking a weapon uses one up -->
        <a-tooltip :title="totemHint(column.raid)">
          <div class="mt-1 flex items-center justify-center gap-1">
            <img :src="totemIcon(column.raid)" :alt="column.raid.totem.name" class="size-5" />
            <a-input-number
              size="small"
              class="w-14!"
              :min="0"
              :max="MAX_TOTEMS"
              :precision="0"
              :value="ultimates.totemsHeld(column.raid)"
              :aria-label="`${column.raid.totem.name} held`"
              @change="(value: number | string | null) => ultimates.setTotemsHeld(column.raid, Number(value ?? 0))"
            />
          </div>
        </a-tooltip>
      </template>
    </template>

    <template #bodyCell="{ column, record }">
      <a-space v-if="column.key === 'job'" :size="8" class="whitespace-nowrap">
        <a-avatar :src="jobIconPath(record.job)" shape="square" :size="24" />
        {{ jobDisplayName(record.job) }}
      </a-space>
      <!-- Looks like a BiS card's slot: the job's weapon from that ultimate, green with a tick once it's had -->
      <template v-else-if="column.raid">
        <a-tooltip v-if="column.raid.weapons[record.job]" :title="weaponHint(column.raid, record.job)" :mouse-enter-delay="0.4">
          <button
            type="button"
            class="relative size-10 cursor-pointer rounded-md border-2 align-middle transition hover:brightness-125"
            :class="ultimates.has(column.raid, record.job) ? doneClass : pendingClass"
            :aria-pressed="ultimates.has(column.raid, record.job)"
            :aria-label="`${jobDisplayName(record.job)} ${column.raid.short} weapon`"
            @click="ultimates.toggle(column.raid, record.job)"
          >
            <!-- The generic ultimate icon until XIVAPI has answered, or if it couldn't -->
            <img :src="weaponOf(column.raid, record.job)?.icon ?? ultimateIcon" alt="" class="size-full rounded p-0.5" />
            <span
              v-if="ultimates.has(column.raid, record.job)"
              class="absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full bg-gray-900 p-0.5"
            >
              <check-icon class="size-full" />
            </span>
          </button>
        </a-tooltip>
        <a-tooltip v-else :title="`${jobDisplayName(record.job)} came after ${column.raid.short}: no weapon`">
          <a-typography-text type="secondary" class="inline-block size-10 leading-10">—</a-typography-text>
        </a-tooltip>
      </template>
      <div v-else-if="column.key === 'progress'" class="flex items-center gap-2">
        <div class="w-24 shrink-0">
          <a-progress :percent="Math.round((record.done / record.total) * 100)" :show-info="false" size="small" class="m-0!" />
        </div>
        <!-- Count and Done tag share one fixed slot, so finishing a job doesn't resize the column -->
        <div class="flex h-[22px] w-[4.5rem] shrink-0 items-center">
          <a-tag v-if="record.done === record.total" color="success" class="m-0!">
            <template #icon><check-circle-filled /></template>
            Done
          </a-tag>
          <a-typography-text v-else type="secondary" class="text-xs whitespace-nowrap tabular-nums">
            {{ record.done }} / {{ record.total }}
          </a-typography-text>
        </div>
      </div>
    </template>
  </a-table>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { message, type TableColumnType } from 'ant-design-vue'
import { CheckCircleFilled, SyncOutlined, UserOutlined } from '@ant-design/icons-vue'
import { hasFFLogsCredentials } from '@/api/auth'
import { ultimateRaids, type UltimateRaid } from '@/constants/ultimateWeapons'
import { equipmentStatuses } from '@/constants/equipmentStatus'
import { EquipmentStatus } from '@/types/EquipmentType'
import ultimateIcon from '@/assets/ultimate.png'
import { jobDisplayName, jobsByRole } from '@/constants/jobs'
import { characterLabel } from '@/api/fflogsCharacter'
import { MAX_TOTEMS, useUltimateStore, type BestLog } from '@/stores/ultimateStore'
import { parseColor } from '@/constants/parseColors'
import { useProfileStore } from '@/stores/profileStore'
import { useItemCatalogStore } from '@/stores/itemCatalogStore'
import CheckIcon from './CheckIcon.vue'

const ultimates = useUltimateStore()
const profile = useProfileStore()

// quiet: the automatic sync on opening the page, which only speaks up when it found something or failed
async function sync(quiet: boolean) {
  try {
    const added = await ultimates.syncClears()
    if (added > 0) message.success(`Synced clears: ${added} totem${added === 1 ? '' : 's'} added`)
    else if (!quiet) message.info('Synced clears: no new ones')
  } catch (err) {
    message.error(`Couldn't sync clears from FF Logs: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// Opening the page picks up clears made since the last sync, at most once an hour (each sync spends FF Logs API points).
// So does setting a character in the profile (or the profile loading after the page): it hasn't been synced yet.
const SYNC_EVERY_MS = 60 * 60 * 1000
watch(
  () => ultimates.character,
  (character) => {
    if (hasFFLogsCredentials && character && !ultimates.syncing && Date.now() - (ultimates.syncedAt ?? 0) > SYNC_EVERY_MS) void sync(true)
  },
  { immediate: true },
)

const jobIconPath = (job: string) => `/job/${job}.png`
// The BiS card's slot borders: an unowned ultimate weapon's grey, an acquired piece's green
const pendingClass = equipmentStatuses[EquipmentStatus.ULTIMATE].className
const doneClass = equipmentStatuses[EquipmentStatus.ACQUIRED].className

// Every ultimate's weapons and totems, looked up on XIVAPI for their icons and names
const catalog = useItemCatalogStore()
void catalog.ensureItems(ultimateRaids.flatMap((raid) => [...Object.values(raid.weapons), raid.totem.id]))

// The generic ultimate icon until XIVAPI has answered, or if it couldn't
const totemIcon = (raid: UltimateRaid) => catalog.items[raid.totem.id]?.icon ?? ultimateIcon

const weaponOf = (raid: UltimateRaid, job: string) => {
  const id = raid.weapons[job]
  return id === undefined ? undefined : catalog.items[id]
}

// The weapon's tooltip: its name, and what ticking or unticking it does with the ultimate's totems
function weaponHint(raid: UltimateRaid, job: string) {
  const name = weaponOf(raid, job)?.name ?? `${raid.short} weapon`
  if (ultimates.has(raid, job)) {
    const refund = ultimates.usedTotem(raid, job) ? ` (gives back 1 ${raid.totem.name})` : ''
    return `${name}: had. Click to undo${refund}`
  }
  const use = ultimates.totemsHeld(raid) > 0 ? ` (uses 1 of your ${raid.totem.name}s)` : ''
  return `${name}: click to mark had${use}`
}

function totemHint(raid: UltimateRaid) {
  const held = ultimates.totemsHeld(raid)
  return `${raid.totem.name}s held: enough for ${held} weapon${held === 1 ? '' : 's'}. Each ${raid.short} weapon takes 1; ticking one uses it up, unticking gives it back.`
}

const logUrl = (log: BestLog) => `https://www.fflogs.com/reports/${log.report}#fight=${log.fight}`

function bestHint(log: BestLog) {
  const when = log.startTime ? ` on ${new Date(log.startTime).toLocaleDateString()}` : ''
  return `Best parse: ${log.percent.toFixed(1)} as ${jobDisplayName(log.spec)}, ${Math.round(log.amount).toLocaleString()} rDPS${when}. Click to open the log.`
}

function killsHint(raid: UltimateRaid) {
  const kills = ultimates.loggedClears(raid)
  if (kills === undefined) return `Not synced yet: sync clears to count ${raid.short} kills on FF Logs`
  const ids = raid.encounters.length > 1 ? `, across its ${raid.encounters.length} FF Logs encounters (one per release)` : ''
  return `${characterLabel(ultimates.character!)}'s ${raid.name} kills on FF Logs at the last sync, on every job${ids}. Only public logs count.`
}

// Every combat job, in role order like the rest of the tracker; total: the ultimates it has a weapon from
const rows = computed(() =>
  jobsByRole.flatMap((group) =>
    group.jobs.map((job) => {
      const raids = ultimateRaids.filter((raid) => raid.weapons[job])
      return { job, done: raids.filter((raid) => ultimates.has(raid, job)).length, total: raids.length }
    }),
  ),
)

// A column's header box: every job's weapon had, or not. Clicking it ticks the rest (held totems going to the jobs listed
// first), or unticks them all when they were all had.
const raidAllHad = (raid: UltimateRaid) => ultimates.countFor(raid) === raid.jobs.length
const toggleRaid = (raid: UltimateRaid) =>
  ultimates.setAll(
    raid,
    !raidAllHad(raid),
    rows.value.filter((row) => raid.weapons[row.job]).map((row) => row.job),
  )

const summary = computed(() => {
  const total = rows.value.reduce((sum, row) => sum + row.total, 0)
  const done = rows.value.reduce((sum, row) => sum + row.done, 0)
  return {
    done,
    total,
    percent: Math.round((done / total) * 100),
    raidsComplete: ultimateRaids.filter((raid) => ultimates.countFor(raid) === raid.jobs.length).length,
    jobsComplete: rows.value.filter((row) => row.done === row.total).length,
  }
})

// A summary figure keeps the width of the widest it can get (tabular digits, so ch is one digit), so the blocks after
// it don't move as it changes
const widthFor = (widest: string) => ({ minWidth: `${widest.length}ch` })

type UltimateColumn = TableColumnType & { raid?: UltimateRaid }

const columns: UltimateColumn[] = [
  { key: 'job', title: 'Job', fixed: 'left' },
  ...ultimateRaids.map((raid): UltimateColumn => ({ key: raid.key, raid, align: 'center' })),
  { key: 'progress', title: 'Progress', fixed: 'right' },
]
</script>

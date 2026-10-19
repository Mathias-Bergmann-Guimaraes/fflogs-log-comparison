<template>
  <a-card size="small" title="By role">
    <template #extra>
      <a-typography-text type="secondary" class="text-xs">Weeks per role on its own, ignoring your stock</a-typography-text>
    </template>
    <a-table :data-source="rows" :columns="columns" row-key="role" size="small" :pagination="false" :scroll="{ x: 900 }">
      <template #headerCell="{ column }">
        <a-tooltip v-if="column.icon || column.floor" :title="column.label">
          <floor-book v-if="column.floor" :floor="column.floor" :size="18" />
          <img v-else :src="column.icon" alt="" class="inline size-4" />
        </a-tooltip>
      </template>

      <template #bodyCell="{ column, record }">
        <span v-if="column.key === 'role'" class="font-semibold">{{ record.role }}</span>
        <div v-else-if="column.key === 'progress'" class="flex items-center gap-2">
          <div class="w-24 shrink-0"><a-progress :percent="record.percent" :show-info="false" size="small" class="m-0!" /></div>
          <a-typography-text type="secondary" class="text-xs whitespace-nowrap tabular-nums">
            {{ record.acquired }} / {{ record.total }}
          </a-typography-text>
        </div>
        <a-typography-text v-else-if="column.key === 'tracked'" type="secondary" class="tabular-nums">
          {{ record.tracked }} / {{ record.jobs }}
        </a-typography-text>
        <span v-else-if="column.numeric" class="tabular-nums" :class="record[column.key] === 0 ? 'text-gray-500' : ''">
          {{ record[column.key].toLocaleString() }}
        </span>
        <a-tag v-else-if="column.key === 'weeks'" :color="record.weeks === 0 ? 'success' : undefined" class="m-0! tabular-nums">
          {{ record.weeks === 0 ? 'Done' : `${record.weeks} wk` }}
        </a-tag>
      </template>
    </a-table>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TableColumnType } from 'ant-design-vue'
import type { RaidFloor } from '@/constants/raidFloors'
import { EquipmentStatus } from '@/types/EquipmentType'
import { bisSlots } from '@/constants/bisSlots'
import { equipmentStatusIcons } from '@/constants/icons'
import { jobsByRole } from '@/constants/jobs'
import { WEEKLY_TOME_CAP, trackedFloors } from '@/composables/useBisPlan'
import { useBisStore } from '@/stores/bisStore'
import FloorBook from '../FloorBook.vue'

const bis = useBisStore()

const rows = computed(() =>
  jobsByRole.map((group) => {
    const materials = bis.materialsNeeded(group.jobs)
    const books = bis.booksNeeded(group.jobs)
    const total = group.jobs.length * bisSlots.length
    const acquired = group.jobs.reduce((sum, job) => sum + bisSlots.filter((_, i) => bis.statusOf(job, i) === EquipmentStatus.ACQUIRED).length, 0)
    const tomeWeeks = Math.ceil(materials.tomes / WEEKLY_TOME_CAP)
    const raidWeeks = Math.max(0, ...trackedFloors.map((f) => books[f.floor]))
    return {
      role: group.role,
      jobs: group.jobs.length,
      tracked: group.jobs.filter(bis.isTracked).length,
      acquired,
      total,
      percent: Math.round((acquired / total) * 100),
      tomes: materials.tomes,
      twines: materials.twines,
      glazes: materials.glazes,
      solvents: materials.solvents,
      ...Object.fromEntries(trackedFloors.map((f) => [`floor${f.floor}`, books[f.floor]])),
      weeks: Math.max(tomeWeeks, raidWeeks),
    }
  }),
)

// Icon columns carry their icon/label for the header cell; numeric ones share one body renderer
type RoleColumn = TableColumnType & { label?: string; icon?: string; floor?: RaidFloor; numeric?: boolean }

const columns: RoleColumn[] = [
  { key: 'role', title: 'Role', width: 140, fixed: 'left' },
  { key: 'progress', title: 'Progress', width: 190 },
  { key: 'tracked', title: 'Tracked', width: 80 },
  { key: 'tomes', label: 'Tomestones', icon: equipmentStatusIcons[EquipmentStatus.TOME], numeric: true, align: 'right' },
  { key: 'twines', label: 'Twines', icon: equipmentStatusIcons[EquipmentStatus.TWINE], numeric: true, align: 'right' },
  { key: 'glazes', label: 'Glazes', icon: equipmentStatusIcons[EquipmentStatus.GLAZE], numeric: true, align: 'right' },
  { key: 'solvents', label: 'Solvents', icon: equipmentStatusIcons[EquipmentStatus.SOLVENT], numeric: true, align: 'right' },
  ...trackedFloors.map((f) => ({ key: `floor${f.floor}`, label: `${f.label} books`, floor: f.floor, numeric: true, align: 'right' as const })),
  { key: 'weeks', title: 'Weeks', width: 90, align: 'center' },
]
</script>

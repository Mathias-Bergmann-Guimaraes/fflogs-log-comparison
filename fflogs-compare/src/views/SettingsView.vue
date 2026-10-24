<template>
  <!-- The account's tunable numbers (settingsStore). Edited as a draft, applied on Save. -->
  <div class="p-5">
    <a-typography-title :level="4" class="mb-4!">Settings</a-typography-title>

    <div class="flex max-w-3xl flex-col gap-4">
      <a-card size="small" title="BiS Tracker">
        <a-form layout="vertical">
          <a-form-item label="Weekly tomestone cap" help="The most tomestones a week can earn. Switch to 900 while the cap is doubled." class="mb-0!">
            <a-segmented v-model:value="draft.weeklyTomeCap" :options="tomeCapOptions" />
          </a-form-item>
        </a-form>
      </a-card>

      <a-card v-if="auth.hasFeature('hunts')" size="small" title="Hunt Tracker">
        <a-form layout="vertical">
          <div class="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <a-form-item label="S rank stays up for" help="After it's reported: the feed never says when one dies.">
              <a-input-number v-model:value="draft.sRankUpMinutes" v-bind="upInput" addon-after="min" />
            </a-form-item>
            <a-form-item label="SS rank stays up for" help="SS ranks only spawn from Shadowbringers on.">
              <a-input-number v-model:value="draft.ssRankUpMinutes" v-bind="upInput" addon-after="min" />
            </a-form-item>
            <a-form-item
              label="A ranks respawn"
              :validate-status="draft.respawnMaxHours < draft.respawnMinHours ? 'error' : undefined"
              :help="
                draft.respawnMaxHours < draft.respawnMinHours
                  ? 'The window can\'t end before it starts.'
                  : 'Between these two times after a train ends.'
              "
            >
              <div class="flex flex-wrap items-center gap-2">
                <a-input-number v-model:value="draft.respawnMinHours" v-bind="respawnInput" addon-after="h" aria-label="Respawn from" />
                <a-typography-text type="secondary">to</a-typography-text>
                <a-input-number v-model:value="draft.respawnMaxHours" v-bind="respawnInput" addon-after="h" aria-label="Respawn to" />
              </div>
            </a-form-item>
            <a-form-item label="A train runs for" help="After its start time. A post without one counts from when it was posted.">
              <div class="flex flex-wrap items-center gap-2">
                <a-input-number v-model:value="draft.trainRunningMinutes" v-bind="runningInput" addon-after="min" aria-label="Running time" />
                <a-typography-text type="secondary">untimed</a-typography-text>
                <a-input-number
                  v-model:value="draft.trainUntimedMinutes"
                  v-bind="runningInput"
                  addon-after="min"
                  aria-label="Running time without a start time"
                />
              </div>
            </a-form-item>
            <a-form-item label="A ranks per train" help="Assumed when a post doesn't say how many marks (e.g. &quot;12/12&quot;).">
              <a-input-number v-model:value="draft.trainMarks" v-bind="marksInput" addon-after="marks" />
            </a-form-item>
          </div>
        </a-form>

        <a-collapse ghost>
          <a-collapse-panel key="advanced" header="Advanced: per expansion">
            <a-typography-paragraph type="secondary" class="text-xs">
              Leave a field empty to use the value above. An S rank whose expansion isn't known always uses the value above.
            </a-typography-paragraph>

            <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <a-table :columns="sRankColumns" :data-source="expansionRows" :pagination="false" size="small" row-key="key">
                <template #bodyCell="{ column, record }">
                  <a-tooltip v-if="column.key === 'expansion'" :title="record.name">
                    <a-tag :color="record.color" class="me-0!">{{ record.label }}</a-tag>
                  </a-tooltip>
                  <a-input-number
                    v-else-if="column.key === 's'"
                    v-model:value="draft.sRankUpByExpansion[record.key as ExpansionKey]"
                    v-bind="upInput"
                    :placeholder="String(draft.sRankUpMinutes)"
                    addon-after="min"
                    size="small"
                    :aria-label="`${record.name} S rank`"
                  />
                  <template v-else-if="column.key === 'ss'">
                    <a-input-number
                      v-if="hasSSRanks(record.key)"
                      v-model:value="draft.ssRankUpByExpansion[record.key as ExpansionKey]"
                      v-bind="upInput"
                      :placeholder="String(draft.ssRankUpMinutes)"
                      addon-after="min"
                      size="small"
                      :aria-label="`${record.name} SS rank`"
                    />
                    <a-typography-text v-else type="secondary">—</a-typography-text>
                  </template>
                </template>
              </a-table>

              <a-table :columns="respawnColumns" :data-source="TRAIN_TYPES" :pagination="false" size="small" row-key="key">
                <template #bodyCell="{ column, record }">
                  <a-tooltip v-if="column.key === 'train'" :title="record.expansion">
                    <a-tag :color="record.color" class="me-0!">{{ record.label }}</a-tag>
                  </a-tooltip>
                  <a-input-number
                    v-else
                    v-model:value="draft.respawnByType[record.key as TrainTypeKey]![column.key as 'min' | 'max']"
                    v-bind="respawnInput"
                    :placeholder="String(column.key === 'min' ? draft.respawnMinHours : draft.respawnMaxHours)"
                    addon-after="h"
                    size="small"
                    :aria-label="`${record.expansion} respawn ${column.key === 'min' ? 'from' : 'to'}`"
                  />
                </template>
              </a-table>

              <a-table :columns="marksColumns" :data-source="TRAIN_TYPES" :pagination="false" size="small" row-key="key">
                <template #bodyCell="{ column, record }">
                  <a-tooltip v-if="column.key === 'train'" :title="record.expansion">
                    <a-tag :color="record.color" class="me-0!">{{ record.label }}</a-tag>
                  </a-tooltip>
                  <a-input-number
                    v-else
                    v-model:value="draft.trainMarksByType[record.key as TrainTypeKey]"
                    v-bind="marksInput"
                    :placeholder="String(draft.trainMarks)"
                    addon-after="marks"
                    size="small"
                    :aria-label="`${record.expansion} A ranks per train`"
                  />
                </template>
              </a-table>
            </div>
          </a-collapse-panel>
        </a-collapse>
      </a-card>

      <div class="flex flex-wrap items-center gap-2">
        <a-button type="primary" :disabled="!dirty" :loading="saving" @click="save">Save</a-button>
        <a-button :disabled="!dirty" @click="discard">Discard changes</a-button>
        <a-button :disabled="isDefault" @click="draft = toDraft(DEFAULT_PREFERENCES)">Reset to defaults</a-button>
        <a-typography-text v-if="dirty" type="secondary" class="text-xs">Unsaved changes</a-typography-text>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message, type TableColumnType } from 'ant-design-vue'
import { useAuthStore } from '@/stores/authStore'
import { DEFAULT_PREFERENCES, LIMITS, TOME_CAPS, normalize, useSettingsStore, type Preferences } from '@/stores/settingsStore'
import { EXPANSIONS, hasSSRanks, type ExpansionKey } from './hunts/dashboard/sRanks'
import { TRAIN_TYPES, type TrainTypeKey } from './hunts/dashboard/trains'

const auth = useAuthStore()
const settings = useSettingsStore()

// A copy to edit, with an (empty) override for every train type so the table can bind to it; normalize drops the empty ones
const toDraft = (p: Preferences): Preferences => {
  const copy: Preferences = JSON.parse(JSON.stringify(p))
  for (const t of TRAIN_TYPES) copy.respawnByType[t.key] ??= {}
  return copy
}

const draft = ref<Preferences>(toDraft(settings.preferences))
const same = (a: Preferences, b: Preferences) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
const dirty = computed(() => !same(draft.value, settings.preferences))
const isDefault = computed(() => same(draft.value, DEFAULT_PREFERENCES))

// The saved settings arrive after login: show them, unless something's being edited already
watch(
  () => settings.preferences,
  (saved, previous) => {
    if (same(draft.value, previous)) draft.value = toDraft(saved)
  },
)

const saving = ref(false)
async function save() {
  saving.value = true
  if (await settings.save(draft.value)) {
    draft.value = toDraft(settings.preferences)
    message.success('Settings saved')
  }
  saving.value = false
}

const discard = () => (draft.value = toDraft(settings.preferences))

const tomeCapOptions = TOME_CAPS.map((cap) => ({ value: cap, label: String(cap) }))

const upInput = { ...LIMITS.upMinutes, precision: 0 }
const respawnInput = { ...LIMITS.respawnHours, step: 0.5, precision: 1 }
const runningInput = { ...LIMITS.runningMinutes, step: 5, precision: 0 }
const marksInput = { ...LIMITS.trainMarks, precision: 0 }

// Newest expansion first, like the hunt dashboard
const expansionRows = (Object.keys(EXPANSIONS).map(Number) as ExpansionKey[]).reverse().map((key) => ({ key, ...EXPANSIONS[key] }))

const sRankColumns: TableColumnType[] = [
  { key: 'expansion', title: 'Expansion' },
  { key: 's', title: 'S rank up' },
  { key: 'ss', title: 'SS rank up' },
]

const respawnColumns: TableColumnType[] = [
  { key: 'train', title: 'Train' },
  { key: 'min', title: 'Respawn from' },
  { key: 'max', title: 'Respawn to' },
]

const marksColumns: TableColumnType[] = [
  { key: 'train', title: 'Train' },
  { key: 'marks', title: 'A ranks per train' },
]
</script>

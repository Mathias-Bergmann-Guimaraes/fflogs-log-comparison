<template>
  <a-modal
    v-model:open="open"
    :title="set ? `Edit ${set.name}` : 'New gear set'"
    :width="620"
    :ok-text="set ? 'Save' : 'Create'"
    :ok-button-props="{ disabled: !!problem }"
    :confirm-loading="saving"
    @ok="onSave"
  >
    <p class="mb-4 text-sm text-gray-400">
      Track a group of jobs on gear of your choosing, apart from the default set. Handy for an ultimate, which syncs you to an older tier's gear.
    </p>

    <a-form layout="vertical">
      <a-form-item label="Name" required>
        <a-input v-model:value="name" :maxlength="40" placeholder="e.g. TOP static" />
      </a-form-item>

      <a-form-item label="Gear" required>
        <a-select :value="preset" :options="presetOptions" @change="onPresetChange($event as string)" />
        <a-space v-if="preset === CUSTOM" class="mt-2">
          <a-input-number v-model:value="minIlvl" :min="1" :max="999" :precision="0" placeholder="From" addon-before="i" />
          <a-typography-text type="secondary">to</a-typography-text>
          <a-input-number v-model:value="maxIlvl" :min="1" :max="999" :precision="0" placeholder="To" addon-before="i" />
        </a-space>
        <template #extra>
          <template v-if="preset === CUSTOM">
            Each slot offers the gear in this range, and Raid and Tome show the range's best raid and tome pieces.
          </template>
          <template v-else>
            Gear from i{{ minIlvl }} to i{{ maxIlvl }}: the tier the ultimate syncs to, plus the dungeon and crafted gear below it. Raid and Tome show
            that tier's pieces.
          </template>
        </template>
      </a-form-item>

      <a-form-item label="Jobs" required>
        <div class="flex flex-col gap-2">
          <div v-for="group in jobsByRole" :key="group.role" class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <a-checkbox
              class="w-36"
              :checked="roleState(group.jobs) === 'all'"
              :indeterminate="roleState(group.jobs) === 'some'"
              @change="toggleRole(group.jobs, $event.target.checked)"
            >
              <span class="font-semibold">{{ group.role }}</span>
            </a-checkbox>
            <a-checkbox v-for="job in group.jobs" :key="job" :checked="jobs.includes(job)" @change="toggleJob(job, $event.target.checked)">
              <a-tooltip :title="jobDisplayName(job)">
                <img :src="`/job/${job}.png`" :alt="jobDisplayName(job)" class="size-6" />
              </a-tooltip>
            </a-checkbox>
          </div>
        </div>
      </a-form-item>
    </a-form>

    <a-alert
      v-if="removed.length"
      type="warning"
      show-icon
      :message="`Progress on ${removed.map(jobDisplayName).join(', ')} in this set is deleted when you save.`"
    />
    <a-alert v-if="error" type="error" :message="error" show-icon class="mt-3" />
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { jobDisplayName, jobsByRole } from '@/constants/jobs'
import { ultimateForRange, ultimateRange, ultimates } from '@/constants/ultimates'
import { useGearSetsStore, type GearSet } from '@/stores/gearSetsStore'

// Creates a gear set, or edits `set`
const props = defineProps<{ set?: GearSet }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [set: GearSet] }>()

const gearSets = useGearSetsStore()

const name = ref('')
const jobs = ref<string[]>([])
const minIlvl = ref<number | null>(null)
const maxIlvl = ref<number | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

// An ultimate's key, whose sync sets the range, or CUSTOM to type one in
const CUSTOM = 'custom'
const preset = ref<string>(ultimates[0]!.key)
const presetOptions = [
  ...ultimates.map((u) => ({ value: u.key, label: `${u.key} · ${u.name} (i${u.sync})` })),
  { value: CUSTOM, label: 'Custom item level range' },
]

// Picking an ultimate sets its range, and names the set after it unless it already has a name of its own
function onPresetChange(key: string) {
  const previous = preset.value
  preset.value = key
  const ultimate = ultimates.find((u) => u.key === key)
  if (!ultimate) return
  ;({ minIlvl: minIlvl.value, maxIlvl: maxIlvl.value } = ultimateRange(ultimate.sync))
  if (!name.value.trim() || name.value === previous) name.value = ultimate.key
}

// Start from the set being edited, or blank, each time it opens
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    name.value = props.set?.name ?? ''
    jobs.value = [...(props.set?.jobs ?? [])]
    error.value = null
    if (props.set) {
      minIlvl.value = props.set.minIlvl
      maxIlvl.value = props.set.maxIlvl
      preset.value = ultimateForRange(props.set.minIlvl, props.set.maxIlvl)?.key ?? CUSTOM
    } else {
      // Newest ultimate by default (the name is still blank, so it's named after it)
      onPresetChange(ultimates[0]!.key)
    }
  },
  { immediate: true },
)

const roleState = (roleJobs: string[]) => {
  const picked = roleJobs.filter((job) => jobs.value.includes(job)).length
  return picked === 0 ? 'none' : picked === roleJobs.length ? 'all' : 'some'
}

function toggleRole(roleJobs: string[], checked: boolean) {
  jobs.value = checked ? [...new Set([...jobs.value, ...roleJobs])] : jobs.value.filter((job) => !roleJobs.includes(job))
}

function toggleJob(job: string, checked: boolean) {
  jobs.value = checked ? [...jobs.value, job] : jobs.value.filter((j) => j !== job)
}

// Jobs taken out of an existing set: the server deletes their progress in it
const removed = computed(() => props.set?.jobs.filter((job) => !jobs.value.includes(job)) ?? [])

// Why it can't be saved yet; the OK button stays disabled until this is null
const problem = computed(() => {
  if (!name.value.trim()) return 'Name it'
  if (minIlvl.value === null || maxIlvl.value === null) return 'Set the item level range'
  if (minIlvl.value > maxIlvl.value) return "The range's start can't be above its end"
  if (!jobs.value.length) return 'Pick at least one job'
  return null
})

async function onSave() {
  if (problem.value) return
  saving.value = true
  error.value = null
  const draft = { name: name.value.trim(), jobs: jobs.value, minIlvl: minIlvl.value!, maxIlvl: maxIlvl.value! }
  try {
    if (props.set) {
      await gearSets.update(props.set.id, draft)
      message.success(`Saved ${draft.name}`)
      emit('saved', gearSets.byId(props.set.id)!)
    } else {
      const created = await gearSets.create(draft)
      message.success(`Created ${created.name}`)
      emit('saved', created)
    }
    open.value = false
  } catch (err) {
    error.value = `Couldn't save: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    saving.value = false
  }
}
</script>

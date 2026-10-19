<template>
  <!-- One tab per gear set: the default one (this tier, every job) is always first; + makes a custom one -->
  <a-tabs :active-key="String(activeId)" type="editable-card" @change="select" @edit="onEdit">
    <a-tab-pane key="0" :closable="false">
      <template #tab>
        Default
        <a-typography-text type="secondary" class="ml-1 text-xs">this tier</a-typography-text>
      </template>
    </a-tab-pane>
    <a-tab-pane v-for="s in gearSets.sets" :key="String(s.id)">
      <template #tab>
        {{ s.name }}
        <a-typography-text type="secondary" class="ml-1 text-xs tabular-nums">{{ rangeLabel(s) }}</a-typography-text>
      </template>
    </a-tab-pane>
    <template #rightExtra>
      <a-button v-if="active" class="ml-2" @click="editOpen = true">
        <template #icon><setting-outlined /></template>
        Edit set
      </a-button>
    </template>
  </a-tabs>

  <!-- Keyed so each set gets a fresh panel (its own store, collapse state and scroll handling) -->
  <gear-set-panel :key="activeId" :set-id="activeId" :jobs="active?.jobs ?? allJobs" />

  <gear-set-dialog v-model:open="createOpen" @saved="select(String($event.id))" />
  <gear-set-dialog v-if="active" v-model:open="editOpen" :set="active" @saved="onEdited" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { SettingOutlined } from '@ant-design/icons-vue'
import { allJobs } from '@/constants/gearSharing'
import { ultimateForRange } from '@/constants/ultimates'
import { useBisStore } from '@/stores/bisStore'
import { useGearSetsStore, type GearSet } from '@/stores/gearSetsStore'
import GearSetPanel from './GearSetPanel.vue'
import GearSetDialog from './GearSetDialog.vue'
import { activeGearSetId } from './activeGearSet'

const route = useRoute()
const router = useRouter()
const gearSets = useGearSetsStore()

// The open set lives in ?set=, so a refresh or a shared link reopens it; anything unknown is the default set
const activeId = computed(() => activeGearSetId(route, gearSets.sets))
const active = computed(() => gearSets.byId(activeId.value))

// 'FRU i735' for an ultimate preset (just 'i735' when the set is already named FRU), else the range itself
function rangeLabel(set: GearSet) {
  const ultimate = ultimateForRange(set.minIlvl, set.maxIlvl)
  if (!ultimate) return `i${set.minIlvl}–${set.maxIlvl}`
  return ultimate.key === set.name ? `i${ultimate.sync}` : `${ultimate.key} i${ultimate.sync}`
}

const createOpen = ref(false)
const editOpen = ref(false)

function select(key: string | number) {
  router.replace({ query: { ...route.query, set: key === '0' ? undefined : String(key) } })
}

function onEdit(targetKey: string | MouseEvent, action: 'add' | 'remove') {
  if (action === 'add') return void (createOpen.value = true)
  const set = gearSets.byId(Number(targetKey))
  if (!set) return
  Modal.confirm({
    title: `Delete ${set.name}?`,
    content: 'Its progress is deleted with it. The default set and your other sets are not affected.',
    okText: 'Delete',
    okType: 'danger',
    async onOk() {
      try {
        await gearSets.remove(set.id)
        if (activeId.value === set.id) select('0')
        message.success(`Deleted ${set.name}`)
      } catch (err) {
        message.error(`Couldn't delete: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  })
}

// Jobs taken out of the set lost their progress on the server, so reload it
function onEdited(set: GearSet) {
  void useBisStore(set.id)
    .load()
    .catch((err) => message.error(`Couldn't reload ${set.name}: ${err instanceof Error ? err.message : String(err)}`))
}
</script>

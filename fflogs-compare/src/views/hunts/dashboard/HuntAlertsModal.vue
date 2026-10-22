<template>
  <a-modal v-model:open="open" title="Hunt alerts" ok-text="Save" :confirm-loading="saving" @ok="onSave">
    <a-typography-paragraph type="secondary">
      The bell in the header gets a dot while a hunt matching any of these is running or announced. With no rules, it stays quiet.
    </a-typography-paragraph>

    <div v-for="(rule, i) in draft" :key="i" class="mb-2 flex items-center gap-2">
      <a-select v-model:value="rule.rank" :options="rankOptions" class="w-32" />
      <span>on</span>
      <a-select v-model:value="rule.dc" :options="dcOptions" class="w-32" />
      <a-button type="text" danger :aria-label="`Remove rule ${i + 1}`" @click="draft.splice(i, 1)">
        <template #icon><DeleteOutlined /></template>
      </a-button>
    </div>
    <a-empty v-if="!draft.length" :image="Empty.PRESENTED_IMAGE_SIMPLE" description="No alerts" />

    <a-button type="dashed" block class="mt-2" @click="draft.push({ rank: 'A', dc: 'any' })">
      <template #icon><PlusOutlined /></template>
      Add rule
    </a-button>

    <a-alert v-if="draft.some((r) => r.rank === 'S')" type="info" show-icon class="mt-4!" message="S ranks aren't tracked yet, so S rank rules won't do anything until they are." />
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Empty } from 'ant-design-vue'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { HUNT_RANKS, useHuntAlertsStore, type HuntAlertRule } from '@/stores/huntAlertsStore'
import { DATA_CENTERS } from './trains'

const open = defineModel<boolean>('open', { default: false })

const alerts = useHuntAlertsStore()

const rankOptions = [{ value: 'any', label: 'All ranks' }, ...HUNT_RANKS.map((rank) => ({ value: rank, label: `${rank} ranks` }))]
const dcOptions = [{ value: 'any', label: 'All DCs' }, ...DATA_CENTERS.map((dc) => ({ value: dc.name, label: dc.name }))]

const saving = ref(false)
// Edited copy, taken on opening, so cancelling leaves the saved rules alone
const draft = ref<HuntAlertRule[]>([])
watch(open, (isOpen) => {
  if (isOpen) draft.value = alerts.rules.map((rule) => ({ ...rule }))
})

async function onSave() {
  // The same rule twice means nothing more
  const unique = draft.value.filter((rule, i) => draft.value.findIndex((r) => r.rank === rule.rank && r.dc === rule.dc) === i)
  saving.value = true
  const saved = await alerts.save(unique)
  saving.value = false
  if (saved) open.value = false
}
</script>

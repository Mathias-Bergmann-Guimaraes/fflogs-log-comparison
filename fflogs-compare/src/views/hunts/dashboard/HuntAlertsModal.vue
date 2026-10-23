<template>
  <a-modal v-model:open="open" title="Hunt alerts" ok-text="Save" :confirm-loading="saving" @ok="onSave">
    <a-typography-paragraph type="secondary">
      The bell in the header gets a dot while a hunt matching any of these is running or announced, and an S rank matching
      them pops up as soon as it's reported. With no rules, it stays quiet.
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

    <a-alert
      v-if="permission === 'denied' && hasSRule"
      type="warning"
      show-icon
      class="mt-4!"
      message="This browser blocks notifications from this site, so S ranks only pop up while the tab is open. Allow them in the site settings to get them in the background too."
    />
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  permission.value = readPermission()
})

// S rank rules also send a desktop notification while the tab is in the background (see HuntAlertsBell),
// which the browser only allows once asked from a click: asked on saving such a rule
const hasSRule = computed(() => draft.value.some((r) => r.rank !== 'A'))
const readPermission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
const permission = ref(readPermission())

async function onSave() {
  if (hasSRule.value && permission.value === 'default') {
    // Not awaited: the save shouldn't wait on the browser's prompt
    Notification.requestPermission().then((p) => (permission.value = p))
  }
  // The same rule twice means nothing more
  const unique = draft.value.filter((rule, i) => draft.value.findIndex((r) => r.rank === rule.rank && r.dc === rule.dc) === i)
  saving.value = true
  const saved = await alerts.save(unique)
  saving.value = false
  if (saved) open.value = false
}
</script>

<template>
  <context-holder />
  <a-space v-if="layout.editing">
    <a-typography-text type="secondary" class="hidden text-xs md:inline">
      Drag widgets to move them, switch them off to hide them
    </a-typography-text>
    <a-button @click="reset">
      <template #icon><reload-outlined /></template>
      Reset layout
    </a-button>
    <a-button type="primary" @click="layout.editing = false">
      <template #icon><check-outlined /></template>
      Done
    </a-button>
  </a-space>
  <a-button v-else @click="layout.editing = true">
    <template #icon><edit-outlined /></template>
    Customize
  </a-button>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { Button, notification } from 'ant-design-vue'
import { CheckOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { useDashboardLayoutStore } from '@/stores/dashboardLayoutStore'

const layout = useDashboardLayoutStore()

// useNotification (not the static API) so it picks up the dark theme from a-config-provider
const [notify, ContextHolder] = notification.useNotification()

function reset() {
  const undo = layout.reset()
  const key = 'dashboard-layout-reset'
  notify.info({
    key,
    message: 'Dashboard layout reset',
    placement: 'bottomRight',
    duration: 6,
    btn: () =>
      h(
        Button,
        {
          size: 'small',
          onClick: () => {
            notify.destroy(key)
            undo()
          },
        },
        () => 'Undo',
      ),
  })
}
</script>

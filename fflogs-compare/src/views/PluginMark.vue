<template>
  <!-- A plug next to a value the game plugin filled in (pluginStore); gone once it's changed by hand.
       With the Settings option on, a gray one stands in where the plugin could fill it in but hasn't. -->
  <span v-if="from || settings.showPluginTrackable" class="inline-flex shrink-0">
    <a-tooltip :title="title">
      <api-outlined
        :style="{ color: from ? PLUGIN_COLOR : PLUGIN_TRACKABLE_COLOR }"
        role="img"
        :aria-label="from ? 'From the game plugin' : PLUGIN_TRACKABLE_TEXT"
      />
    </a-tooltip>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ApiOutlined } from '@ant-design/icons-vue'
import { PLUGIN_COLOR, PLUGIN_TRACKABLE_COLOR, PLUGIN_TRACKABLE_TEXT, usePluginStore } from '@/stores/pluginStore'
import { useSettingsStore } from '@/stores/settingsStore'

// field: a pluginStore field key; value: the value shown, so the mark goes once it's no longer the plugin's
// (left out for a value only the plugin gives)
const props = defineProps<{ field: string; value?: number }>()

const plugin = usePluginStore()
const settings = useSettingsStore()
const from = computed(() => plugin.sent(props.field, props.value))
const title = computed(() => {
  if (!from.value) return PLUGIN_TRACKABLE_TEXT
  const when = new Date(from.value.capturedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  return `From the game plugin${plugin.characterName ? `: ${plugin.characterName}` : ''}, read ${when}`
})
</script>

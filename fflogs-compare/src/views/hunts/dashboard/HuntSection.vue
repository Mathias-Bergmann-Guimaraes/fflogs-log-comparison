<template>
  <!-- One rank's area of the dashboard; fills its column, so the A and S sides end level -->
  <a-card size="small" class="flex! flex-1 flex-col" :body-style="{ flex: 1, display: 'flex', flexDirection: 'column' }">
    <template #title>
      <span class="inline-flex items-center gap-3">
        <span class="font-medium">{{ title }}</span>
        <a-badge :count="count" :number-style="{ backgroundColor: color }" />
      </span>
    </template>
    <template v-if="$slots.extra" #extra><slot name="extra" /></template>
    <slot />
  </a-card>
</template>

<script setup lang="ts">
// count: what's up right now, in the header (hidden at 0)
defineProps<{ title: string; count: number; color: string }>()
</script>

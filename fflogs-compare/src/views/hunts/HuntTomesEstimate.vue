<template>
  <!-- Only for accounts that can open the Hunt Tracker, and only for a currency hunts pay. Hidden rather than removed
       once nothing is needed, so whatever it sits in keeps its size.
       It takes whatever room is left on its line and never asks for more (a size container has no width of its own),
       so in a wrapping row it never pushes onto a line of its own: it picks the layout that fits instead. -->
  <div v-if="huntsPage && estimates.length" class="@container min-w-0 flex-1" :class="needed === 0 && 'invisible'">
    <a-popover placement="bottom" :overlay-style="{ width: '320px' }">
      <template #title>
        <div class="flex items-center gap-2">
          <img :src="currencyIcons[currency]" :alt="currency" class="size-5" />
          {{ needed.toLocaleString() }} {{ currency }} from hunts
        </div>
      </template>

      <template #content>
        <template v-for="(e, i) in estimates" :key="e.kind">
          <a-divider v-if="i" class="my-2!" />
          <div class="mb-1 flex items-baseline justify-between gap-2">
            <a-typography-text type="secondary" class="text-xs tracking-wider uppercase">{{ e.label }}</a-typography-text>
            <a-typography-text type="secondary" class="text-xs">needed, at {{ e.unit }}</a-typography-text>
          </div>
          <div v-for="row in e.rows" :key="row.key" class="grid grid-cols-[3rem_1fr_auto] items-center gap-2 py-0.5">
            <a-tag :color="row.color" class="me-0! text-center">{{ row.tag }}</a-tag>
            <span class="truncate">
              {{ row.name }}
              <a-typography-text type="secondary" class="text-xs">· {{ row.each }} each</a-typography-text>
            </span>
            <span class="font-semibold tabular-nums">{{ row.count.toLocaleString() }}</span>
          </div>
        </template>
        <a-typography-text type="secondary" class="mt-3 block text-xs">
          {{ CAPPED.includes(currency) ? 'Only paid on a level-capped job. ' : '' }}Click for the hunt dashboard.
        </a-typography-text>
      </template>

      <!-- A text button, so it only shows as clickable on hover -->
      <a-button
        type="text"
        class="flex! h-auto! max-w-full items-center px-2! py-1!"
        :tabindex="needed === 0 ? -1 : undefined"
        :aria-label="ariaLabel"
        @click="open"
      >
        <!-- Room enough: like a summary figure (small label over a large number), side by side per kind of hunt -->
        <div class="hidden items-center gap-4 @[19rem]:flex">
          <template v-for="(e, i) in estimates" :key="e.kind">
            <a-divider v-if="i" type="vertical" class="m-0! h-8!" />
            <div class="text-left">
              <a-typography-text type="secondary" class="flex items-center gap-1 text-xs">
                <component :is="iconOf(e)" />
                {{ e.label[0]!.toUpperCase() + e.label.slice(1) }}
              </a-typography-text>
              <span class="text-lg leading-snug font-semibold tabular-nums">
                <span class="text-sm font-normal text-gray-500">≈</span>
                {{ rangeOf(e) }}
              </span>
            </div>
          </template>
        </div>
        <!-- Less room: the figures alone, one under the other, the icon saying which is which -->
        <div class="hidden flex-col items-start text-xs @[7.5rem]:flex @[19rem]:hidden">
          <span v-for="e in estimates" :key="e.kind" class="flex items-center gap-1.5 whitespace-nowrap">
            <component :is="iconOf(e)" class="text-gray-400" />
            <span class="font-semibold tabular-nums">≈ {{ rangeOf(e) }}</span>
          </span>
        </div>
        <!-- Hardly any: an icon, the figures in the popover -->
        <!-- On a div, and important: Ant's display rules (.anticon, and .ant-btn > span) beat Tailwind's hidden -->
        <div class="text-gray-400 @[7.5rem]:hidden!"><AimOutlined /></div>
      </a-button>
    </a-popover>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { AimOutlined, NodeIndexOutlined } from '@ant-design/icons-vue'
import { currencyIcons } from '@/constants/icons'
import { useAuthStore } from '@/stores/authStore'
import type { Currency } from './dashboard/trains'
import { rangeOf, sRanksFor, trainsFor, type HuntEstimate } from './huntEstimates'

// Roughly how many hunt trains and S ranks pay `needed` of a tomestone (or other hunt currency), with a per-expansion
// breakdown on hover; clicking opens the hunt dashboard.
const props = defineProps<{ currency: Currency; needed: number }>()

const router = useRouter()
const auth = useAuthStore()

// The hunt dashboard, if this account may open it: the router's own check (a route's `feature` meta), so this goes
// when the menu entry does
const huntsPage = computed(() => {
  const target = router.resolve({ name: 'huntsDashboard' })
  return target.matched.every((r) => !r.meta.feature || auth.hasFeature(r.meta.feature)) ? target : null
})

const estimates = computed(() => [trainsFor(props.currency, props.needed), sRanksFor(props.currency, props.needed)].filter((e) => e !== null))

const iconOf = (e: HuntEstimate) => (e.kind === 'trains' ? NodeIndexOutlined : AimOutlined)

const ariaLabel = computed(() => `${props.currency} from hunts: ${estimates.value.map((e) => `about ${rangeOf(e)} ${e.label}`).join(', ')}`)

// Only drop on a level-capped job
const CAPPED: Currency[] = ['Mathematics', 'Mnemonics']

function open() {
  if (huntsPage.value && props.needed > 0) router.push(huntsPage.value)
}
</script>

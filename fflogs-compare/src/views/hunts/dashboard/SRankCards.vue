<template>
  <!-- Nothing up: say so, and fill the space with the last ones reported (the section's height is set by the A side) -->
  <div v-if="!up.length" class="flex flex-1 flex-col">
    <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :class="['my-6!', { 'my-auto!': !recent.length }]">
      <template #description>
        <a-typography-text type="secondary">No S rank up right now. New ones show up here as soon as they're reported.</a-typography-text>
      </template>
    </a-empty>

    <template v-if="recent.length">
      <a-typography-text type="secondary" class="text-xs tracking-wider uppercase">Recently reported</a-typography-text>
      <a-list size="small" :data-source="recent" :split="true" class="mt-1">
        <template #renderItem="{ item }: { item: SRank }">
          <a-list-item class="px-0!">
            <div class="flex min-w-0 flex-1 items-center gap-3">
              <span class="inline-block size-2 shrink-0 rounded-full" :style="{ background: DC_COLORS[item.dc] }" />
              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="shrink-0 font-medium">{{ item.world }}</span>
                  <a-typography-text type="secondary" class="truncate">{{ item.mark }}</a-typography-text>
                  <a-tag v-if="item.instance" class="me-0! shrink-0 text-xs">Instance {{ item.instance }}</a-tag>
                  <a-tag v-if="item.ss" :color="S_RANK_COLOR" class="me-0! shrink-0 text-xs">SS</a-tag>
                </div>
                <a-typography-text v-if="item.zone" type="secondary" class="text-xs">{{ item.zone }}</a-typography-text>
              </div>
              <a-tag v-if="item.expansion" :color="EXPANSIONS[item.expansion].color" class="me-0! shrink-0">{{ EXPANSIONS[item.expansion].label }}</a-tag>
              <a-typography-text type="secondary" class="w-24 shrink-0 text-right text-xs">{{ relativeTime(item.spottedAt, tick) }}</a-typography-text>
            </div>
          </a-list-item>
        </template>
      </a-list>
    </template>
  </div>
  <!-- Cards as tall as the A rank trains' (min-h-64), and two of them at most (33rem) before the rest scroll, so both
       sides show two rows. Room on the right for the ribbons, which stick out of the cards, and all round for the
       pinned cards' glow (the negative margin keeps the cards where they were). -->
  <div v-else class="-m-1.5 flex max-h-135 flex-col gap-4 overflow-x-hidden overflow-y-auto p-1.5 pe-3.5 [scrollbar-color:#434343_transparent] [scrollbar-width:thin]">
    <a-badge-ribbon v-for="sRank in up" :key="sRank.id" :text="sRank.ss ? 'SS rank' : 'S rank'" :color="S_RANK_COLOR">
      <!-- Pinned ones get a gold border, like the favorite jobs' cards on the BiS tracker -->
      <a-card size="small" :class="['min-h-64', isPinned(sRank) && 'border-amber-400! shadow-[0_0_12px_rgba(251,191,36,0.25)]']">
        <!-- Horizontal: the post's map on the left (click to enlarge), the details on the right; stacked on a phone -->
        <div class="flex flex-col gap-4 sm:flex-row">
          <div v-if="sRank.image" class="mx-auto size-58 shrink-0 overflow-hidden rounded-md bg-black/30 sm:mx-0">
            <a-image :src="sRank.image" :alt="`Map of ${sRank.zone ?? sRank.mark}`" :width="232" :height="232" class="object-contain" />
          </div>

          <div class="flex min-w-0 flex-1 flex-col">
            <!-- Where, which mark and which expansion -->
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 pe-16">
              <span class="truncate text-xl leading-tight font-semibold">
                <a-tooltip v-if="isPinned(sRank)" title="Pinned expansion"><PushpinFilled class="me-1.5 text-base text-amber-400" /></a-tooltip>{{ sRank.world }}
              </span>
              <span class="flex items-center gap-1.5 text-sm">
                <span class="inline-block size-2 rounded-full" :style="{ background: DC_COLORS[sRank.dc] }" />
                <span :style="{ color: DC_COLORS[sRank.dc] }">{{ sRank.dc }}</span>
                <a-typography-text type="secondary" class="text-xs">· {{ relativeTime(sRank.spottedAt, tick) }}</a-typography-text>
              </span>
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 font-medium"><AimOutlined class="text-gray-400" />{{ sRank.mark }}</span>
              <a-tag v-if="sRank.instance" class="me-0! font-semibold">Instance {{ sRank.instance }}</a-tag>
              <!-- Click for the pin and the filter, set to this expansion -->
              <a-dropdown v-if="sRank.expansion" :trigger="['click']">
                <a-tag :color="EXPANSIONS[sRank.expansion].color" class="me-0! cursor-pointer font-semibold">
                  {{ EXPANSIONS[sRank.expansion].label }} {{ EXPANSIONS[sRank.expansion].name }}
                </a-tag>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="pin" @click="emit('pin', sRank.expansion!)">
                      <template #icon><PushpinOutlined /></template>
                      {{ pinned === sRank.expansion ? 'Unpin' : 'Pin first' }} {{ EXPANSIONS[sRank.expansion].label }}
                    </a-menu-item>
                    <a-menu-item key="filter" @click="emit('filter', sRank.expansion!)">
                      <template #icon><FilterOutlined /></template>
                      {{ onlyExpansion === sRank.expansion ? 'Show all expansions' : `Show only ${EXPANSIONS[sRank.expansion].label}` }}
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>

            <a-divider class="my-2!" />

            <div class="flex flex-col gap-1.5 text-sm">
              <div class="flex items-start gap-2">
                <EnvironmentOutlined class="mt-1 text-gray-400" />
                <div v-if="sRank.zone || sRank.spots.length" class="min-w-0">
                  <span class="font-medium">{{ sRank.zone ?? 'Unknown zone' }}</span>
                  <div v-for="(spot, i) in sRank.spots" :key="i">
                    <a-typography-text type="secondary" class="text-xs">
                      {{ [spot.aetheryte, spot.coords && `(${spot.coords})`].filter(Boolean).join(' · ') }}
                    </a-typography-text>
                  </div>
                </div>
                <a-typography-text v-else type="secondary">Location not in the post</a-typography-text>
              </div>

              <div v-if="sRank.spotter" class="flex items-start gap-2">
                <UserOutlined class="mt-1 text-gray-400" />
                <span class="truncate">{{ sRank.spotter }}</span>
              </div>

              <div v-if="sRankRewards(sRank).length" class="flex items-start gap-2">
                <GiftOutlined class="mt-1 text-gray-400" />
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <a-tooltip v-for="reward in sRankRewards(sRank)" :key="reward.currency" :title="reward.currency">
                    <span class="inline-flex items-center gap-1 tabular-nums">
                      <img :src="currencyIcons[reward.currency]" :alt="reward.currency" class="size-5" />
                      {{ reward.amount }}
                    </span>
                  </a-tooltip>
                </div>
              </div>
            </div>

            <!-- When the card goes away, kept quiet: it's this page's guess, not the S rank's state -->
            <a-tooltip title="The feed doesn't say when an S rank dies, so the card hides a while after it was reported">
              <div class="mt-auto flex items-center gap-2 pt-2 text-xs text-gray-500">
                <a-progress :percent="100 - shownPercent(sRank)" :show-info="false" size="small" stroke-color="rgba(255, 255, 255, 0.25)" trail-color="rgba(255, 255, 255, 0.06)" class="m-0! flex-1" />
                <span class="tabular-nums">hides in {{ hidesIn(sRank) }}</span>
              </div>
            </a-tooltip>
          </div>
        </div>
      </a-card>
    </a-badge-ribbon>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Empty } from 'ant-design-vue'
import { AimOutlined, EnvironmentOutlined, FilterOutlined, GiftOutlined, PushpinFilled, PushpinOutlined, UserOutlined } from '@ant-design/icons-vue'
import { currencyIcons } from '@/constants/icons'
import { relativeTime } from '../discordText'
import { DC_COLORS } from './trains'
import { EXPANSIONS, isUp, sRankRewards, UP_MS, type ExpansionKey, type SRank } from './sRanks'

// onlyExpansion: the one expansion the filter shows, when it's narrowed to exactly one.
// pin and filter toggle that expansion as the pinned one and as the filter's only one.
const props = defineProps<{ sRanks: SRank[]; now: number; pinned: ExpansionKey | null; onlyExpansion: ExpansionKey | null }>()
const emit = defineEmits<{ pin: [ExpansionKey]; filter: [ExpansionKey] }>()

const isPinned = (sRank: SRank) => props.pinned !== null && sRank.expansion === props.pinned

// The pinned expansion's first, then the rest; newest first within each (the sort is stable)
const up = computed(() =>
  props.sRanks.filter((s) => isUp(s, props.now)).sort((a, b) => Number(isPinned(b)) - Number(isPinned(a))),
)

// Shown while none is up: the last few of the day (the store keeps 24 hours)
const RECENT_SHOWN = 6
const recent = computed(() => props.sRanks.filter((s) => !isUp(s, props.now)).slice(0, RECENT_SHOWN))

// The clocks tick every second; which S ranks are shown still follows the store's slower clock (props.now)
const tick = ref(Date.now())
const ticker = setInterval(() => (tick.value = Date.now()), 1000)
onBeforeUnmount(() => clearInterval(ticker))

// Red like the header's S rank alerts
const S_RANK_COLOR = '#f5222d'

// How much of the time it counts as up has passed (an estimate: the feed doesn't say when it dies).
// The bar shows what's left, kept above 0 and under 100, where Ant would switch it to its "success" look.
const shownPercent = (sRank: SRank) => Math.min(99.5, Math.max(0.5, ((tick.value - sRank.spottedAt) / UP_MS) * 100))

// m:ss until the card hides
function hidesIn(sRank: SRank) {
  const seconds = Math.max(0, Math.floor((sRank.spottedAt + UP_MS - tick.value) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
</script>

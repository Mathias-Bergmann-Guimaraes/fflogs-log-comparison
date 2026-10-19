<template>
  <a-card v-if="!active.length" size="small">
    <a-typography-text type="secondary">No train running or announced right now. New ones show up here as soon as they're posted.</a-typography-text>
  </a-card>

  <a-row v-else :gutter="[16, 16]">
    <a-col v-for="train in active" :key="train.id" :xs="24" :sm="12" :xl="8" :xxl="6">
      <a-badge-ribbon :text="train.startsAt <= now ? 'Running' : 'Announced'" :color="train.startsAt <= now ? 'green' : 'orange'">
        <a-card size="small" class="h-full">
          <div class="text-2xl font-semibold tabular-nums">{{ startText(train) }}</div>

          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-xl font-semibold">{{ train.world }}</span>
            <a-typography-text type="secondary">{{ train.dc }}</a-typography-text>
          </div>

          <div class="mt-2 flex flex-wrap gap-1">
            <a-tag v-for="tag in expansionTags(train)" :key="tag.text" :color="tag.color" class="me-0! px-2! text-sm! font-semibold">{{ tag.text }}</a-tag>
          </div>

          <div class="mt-3 flex items-start gap-2">
            <EnvironmentOutlined class="mt-1 text-gray-400" />
            <div v-if="train.start">
              <div class="font-medium">{{ train.start.aetheryte ?? train.start.zone }}</div>
              <a-typography-text v-if="(train.start.aetheryte && train.start.zone) || train.start.instance" type="secondary" class="text-xs">
                {{ [train.start.aetheryte && train.start.zone, train.start.instance && `Instance ${train.start.instance}`].filter(Boolean).join(' · ') }}
              </a-typography-text>
            </div>
            <a-typography-text v-else type="secondary">Starting point not in the post</a-typography-text>
          </div>

          <div class="mt-2 flex items-start gap-2">
            <GiftOutlined class="mt-1 text-gray-400" />
            <div>
              <div class="font-medium">
                {{ train.marks }} marks{{ train.types.length > 1 ? ' each' : '' }}
                <a-tooltip v-if="!train.marksGiven" title="The post doesn't say how many, so this assumes a full train">
                  <a-typography-text type="secondary" class="text-xs font-normal">assumed</a-typography-text>
                </a-tooltip>
              </div>
              <div v-if="trainRewards(train).length" class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <a-tooltip v-for="reward in trainRewards(train)" :key="reward.currency" :title="reward.currency">
                  <span class="inline-flex items-center gap-1 text-sm tabular-nums">
                    <img :src="currencyIcons[reward.currency]" :alt="reward.currency" class="size-5" />
                    {{ reward.amount }}
                  </span>
                </a-tooltip>
              </div>
            </div>
          </div>
        </a-card>
      </a-badge-ribbon>
    </a-col>
  </a-row>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EnvironmentOutlined, GiftOutlined } from '@ant-design/icons-vue'
import { currencyIcons } from '@/constants/icons'
import { pingColor, pingLabel, relativeTime } from '../discordText'
import { TRAIN_TYPES, isActive, trainRewards, trainTypeOfLabel, type Train } from './trains'

const props = defineProps<{ trains: Train[]; now: number; labels: Record<string, string> }>()

// Soonest first: running ones (oldest start on top), then announced
const active = computed(() => props.trains.filter((t) => isActive(t, props.now)).sort((a, b) => a.startsAt - b.startsAt))

const startText = (train: Train) => (train.startsAt <= props.now ? `Started ${relativeTime(train.startsAt, props.now)}` : `Starts ${relativeTime(train.startsAt, props.now)}`)

// The expansion of each role ping, in the ping's colour (as on the A-Rank page); unnamed pings show as they are
function expansionTags(train: Train) {
  return train.pings
    .filter((ping) => ping.startsWith('role:'))
    .map((ping) => {
      const type = TRAIN_TYPES.find((t) => t.key === trainTypeOfLabel(props.labels[ping]))
      return { text: type ? `${type.label} ${type.expansion}` : pingLabel(ping, props.labels), color: pingColor(ping) }
    })
}
</script>

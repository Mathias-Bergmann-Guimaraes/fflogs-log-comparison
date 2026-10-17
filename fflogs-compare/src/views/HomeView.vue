<template>
  <div class="min-h-screen flex flex-col items-center justify-center px-6 py-16">
    <div class="max-w-3xl w-full text-center">
      <div class="flex flex-wrap justify-center gap-2 mb-8 opacity-80">
        <img v-for="job in jobs" :key="job" :src="`/job/${job}.png`" :alt="job" :title="job" class="w-8 h-8" />
      </div>

      <h1 class="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">FF Logs Comparison</h1>
      <p class="text-lg text-gray-400 mb-10">
        Paste an FF Logs report, pick a player, and see how they stack up against the world's top-ranked players of the same job on the same
        encounter.
      </p>

      <a-button type="primary" size="large" @click="router.push({ name: 'compare' })">Start comparing</a-button>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 text-left">
        <div v-for="feature in features" :key="feature.title" class="rounded-lg border border-gray-700 bg-gray-800/60 p-5">
          <h2 class="text-base font-semibold text-gray-100 mb-2">{{ feature.title }}</h2>
          <p class="text-sm text-gray-400">{{ feature.text }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const jobs = [
  'Paladin',
  'Warrior',
  'DarkKnight',
  'Gunbreaker',
  'WhiteMage',
  'Scholar',
  'Astrologian',
  'Sage',
  'Monk',
  'Dragoon',
  'Ninja',
  'Samurai',
  'Reaper',
  'Viper',
  'Bard',
  'Machinist',
  'Dancer',
  'BlackMage',
  'Summoner',
  'RedMage',
  'Pictomancer',
]

const features = [
  { title: 'DPS breakdowns', text: 'rDPS, aDPS, nDPS and cDPS side by side, plus crit and direct-hit rates.' },
  { title: 'Top-player benchmarks', text: 'Compare against the highest-ranked players of the same job on the same fight.' },
  { title: 'Phases & graphs', text: 'Per-phase tables and damage-over-time charts to spot where the gap opens up.' },
]
</script>

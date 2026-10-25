<template>
  <!-- The account's profile, opened from the username in the header (or by any page through the profile store) -->
  <a-modal v-model:open="profile.modalOpen" title="Profile" :footer="null">
    <a-form layout="vertical" class="mt-4">
      <a-form-item label="Username">
        <a-typography-text>{{ auth.user?.username }}</a-typography-text>
      </a-form-item>

      <a-form-item label="Characters">
        <CharacterClaims />
      </a-form-item>

      <!-- Only a claimed character can be it, so nobody links someone else's FF Logs page -->
      <a-form-item
        label="FF Logs character"
        :help="
          characters.claimed.length
            ? 'The Ultimate Weapons page counts your clears from it. FF Logs finds it by its Lodestone page.'
            : 'Claim a character above first: its FF Logs page comes with it.'
        "
        class="mb-0!"
      >
        <div v-if="characters.claimed.length" class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a-select
            :value="characters.fflogsCharacter?.lodestoneId"
            :options="fflogsOptions"
            :loading="savingFFLogs"
            placeholder="None"
            allow-clear
            class="min-w-48"
            @change="setFFLogs"
          />
          <a-tooltip v-if="characters.fflogsCharacter" title="FF Logs">
            <a-button
              type="text"
              size="small"
              :href="fflogsUrl(characters.fflogsCharacter.lodestoneId)"
              target="_blank"
              rel="noopener"
              aria-label="FF Logs"
            >
              <template #icon><img src="/sites/fflogs.png" alt="" class="inline-block size-4 rounded-sm" /></template>
            </a-button>
          </a-tooltip>
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useAuthStore } from '@/stores/authStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useProfileStore } from '@/stores/profileStore'
import { fflogsUrl } from '@/types/characters'
import CharacterClaims from './CharacterClaims.vue'

const auth = useAuthStore()
const profile = useProfileStore()
const characters = useCharacterStore()

const fflogsOptions = computed(() => characters.claimed.map((c) => ({ value: c.lodestoneId, label: `${c.name} (${c.world})` })))

const savingFFLogs = ref(false)
async function setFFLogs(lodestoneId: unknown) {
  savingFFLogs.value = true
  try {
    await characters.setFFLogs(typeof lodestoneId === 'string' ? lodestoneId : null)
  } catch (err) {
    message.error(`Couldn't change your FF Logs character: ${err instanceof Error ? err.message : String(err)}`)
  }
  savingFFLogs.value = false
}
</script>

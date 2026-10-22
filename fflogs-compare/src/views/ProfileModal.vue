<template>
  <!-- The account's profile, opened from the username in the header (or by any page through the profile store) -->
  <a-modal v-model:open="profile.modalOpen" title="Profile" :footer="null" @after-close="editing = false">
    <a-form layout="vertical" class="mt-4">
      <a-form-item label="Username">
        <a-typography-text>{{ auth.user?.username }}</a-typography-text>
      </a-form-item>

      <a-form-item
        label="FF Logs character"
        :validate-status="error ? 'error' : undefined"
        :help="error || 'Your character page on fflogs.com. The Ultimate Weapons page counts your clears from it.'"
      >
        <div v-if="profile.fflogsCharacter && !editing" class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a-typography-link :href="characterUrl(profile.fflogsCharacter)" target="_blank" rel="noopener">
            {{ characterLabel(profile.fflogsCharacter) }}
            <export-outlined />
          </a-typography-link>
          <a-button size="small" @click="startEditing">Change</a-button>
          <a-popconfirm title="Remove your FF Logs character?" ok-text="Remove" @confirm="profile.setFFLogsCharacter(undefined)">
            <a-button size="small" danger>Remove</a-button>
          </a-popconfirm>
        </div>
        <div v-else class="flex gap-2">
          <a-input
            v-model:value="link"
            placeholder="https://www.fflogs.com/character/eu/cerberus/Your%20Name"
            allow-clear
            @change="error = ''"
            @press-enter="save"
          />
          <a-button type="primary" :loading="saving" :disabled="!link.trim()" @click="save">Save</a-button>
          <a-button v-if="profile.fflogsCharacter" @click="editing = false">Cancel</a-button>
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { ExportOutlined } from '@ant-design/icons-vue'
import { hasFFLogsCredentials } from '@/api/auth'
import { characterLabel, characterUrl, lookUpCharacter, parseCharacterLink } from '@/api/fflogsCharacter'
import { useAuthStore } from '@/stores/authStore'
import { useProfileStore } from '@/stores/profileStore'

const auth = useAuthStore()
const profile = useProfileStore()

const editing = ref(false)
const link = ref('')
const error = ref('')
const saving = ref(false)

function startEditing() {
  link.value = profile.fflogsCharacter ? characterUrl(profile.fflogsCharacter) : ''
  error.value = ''
  editing.value = true
}

// The link is checked against FF Logs when the API credentials are there (which also gets the character's id and exact
// name); without them it's saved as pasted
async function save() {
  const parsed = parseCharacterLink(link.value)
  if (!parsed) {
    error.value = 'Not an FF Logs character link, e.g. https://www.fflogs.com/character/eu/cerberus/Your%20Name'
    return
  }
  saving.value = true
  try {
    const character = hasFFLogsCredentials ? await lookUpCharacter(parsed) : parsed
    if (await profile.setFFLogsCharacter(character)) {
      message.success(`FF Logs character set to ${characterLabel(character)}`)
      editing.value = false
      link.value = ''
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}
</script>

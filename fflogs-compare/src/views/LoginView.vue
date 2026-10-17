<template>
  <div class="flex flex-1 items-center justify-center px-6 py-16">
    <div class="w-full max-w-sm rounded-lg border border-gray-700 bg-gray-800/60 p-6">
      <template v-if="providers.google">
        <a-button block size="large" :href="googleHref" class="flex! items-center justify-center gap-2">
          <img src="/google.svg" alt="" class="size-5" />
          Continue with Google
        </a-button>
        <a-divider plain class="text-gray-400!">or</a-divider>
      </template>

      <a-segmented v-model:value="mode" :options="modeOptions" block class="mb-6" />

      <a-form layout="vertical" :model="form" @finish="onSubmit">
        <a-form-item label="Username" name="username" :rules="[{ required: true, message: 'Enter a username' }]">
          <a-input v-model:value="form.username" autocomplete="username" />
        </a-form-item>
        <a-form-item
          label="Password"
          name="password"
          :rules="[
            { required: true, min: mode === 'register' ? 8 : 1, message: mode === 'register' ? 'At least 8 characters' : 'Enter your password' },
          ]"
        >
          <a-input-password v-model:value="form.password" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" />
        </a-form-item>

        <a-alert v-if="error" type="error" :message="error" show-icon class="mb-4" />

        <a-button type="primary" html-type="submit" block :loading="submitting">
          {{ mode === 'login' ? 'Log in' : 'Create account' }}
        </a-button>
      </a-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiFetch } from '@/api/backend'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const mode = ref<'login' | 'register'>('login')
const modeOptions = [
  { label: 'Log in', value: 'login' },
  { label: 'Register', value: 'register' },
]

const form = reactive({ username: '', password: '' })
// Google login failures come back as ?error=<code> from server/google.ts
const errorMessages: Record<string, string> = {
  google_cancelled: 'Google login was cancelled',
  google_expired: 'Google login expired, please try again',
  google_failed: 'Google login failed, please try again',
}
const error = ref<string | null>(errorMessages[String(route.query.error)] ?? null)
const submitting = ref(false)

// Only follow same-app paths, never an external URL
const redirect = computed(() => {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : '/'
})

const providers = ref({ google: false })
apiFetch<{ google: boolean }>('/auth/providers')
  .then((p) => (providers.value = p))
  .catch(console.error)

// A full-page navigation, not fetch: the server redirects the browser to Google
const googleHref = computed(() => `/api/auth/google?redirect=${encodeURIComponent(redirect.value)}`)

watch(mode, () => (error.value = null))

async function onSubmit() {
  error.value = null
  submitting.value = true
  try {
    await (mode.value === 'login' ? auth.login : auth.register)(form.username, form.password)
    router.replace(redirect.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    submitting.value = false
  }
}
</script>

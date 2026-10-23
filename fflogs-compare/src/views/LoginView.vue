<template>
  <div class="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
    <div class="grid w-full max-w-5xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <!-- What an account is for; on narrow screens it shrinks to the heading above the form -->
      <section class="min-w-0 text-center lg:text-left">
        <h1 class="mb-3 text-3xl font-bold text-gray-100 sm:text-4xl">FFXIV Companion</h1>
        <p class="mb-8 text-base text-gray-400">
          Sign in to keep your gear plans, progress and preferences in one place, on every device.
        </p>
        <ul class="hidden flex-col gap-4 lg:flex">
          <li v-for="feature in features" :key="feature.title" class="flex items-start gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-lg text-blue-400">
              <component :is="feature.icon" />
            </span>
            <div class="min-w-0">
              <div class="font-semibold text-gray-100">{{ feature.title }}</div>
              <div class="text-sm text-gray-400">{{ feature.text }}</div>
            </div>
          </li>
        </ul>
      </section>

      <a-card class="mx-auto w-full max-w-md" :body-style="{ padding: '28px' }">
        <h2 class="mb-1 text-xl font-semibold text-gray-100">{{ mode === 'login' ? 'Welcome back' : 'Create your account' }}</h2>
        <p class="mb-6 text-sm text-gray-400">
          <template v-if="redirectLabel">
            Log in to open <span class="text-gray-200">{{ redirectLabel }}</span>.
          </template>
          <template v-else>{{ mode === 'login' ? 'Log in to continue.' : 'It only takes a username and a password.' }}</template>
        </p>

        <template v-if="providers.google">
          <a-button block size="large" :href="googleHref" class="flex! items-center justify-center gap-2">
            <img src="/google.svg" alt="" class="size-5" />
            Continue with Google
          </a-button>
          <a-divider plain class="text-gray-400!">or with a username</a-divider>
        </template>

        <a-form ref="formRef" layout="vertical" :model="form" :required-mark="false" @finish="onSubmit">
          <a-form-item label="Username" name="username" :rules="usernameRules">
            <a-input v-model:value="form.username" size="large" autocomplete="username" placeholder="Your username" autofocus>
              <template #prefix><user-outlined class="text-gray-500" /></template>
            </a-input>
          </a-form-item>
          <a-form-item
            label="Password"
            name="password"
            :rules="[
              {
                required: true,
                min: mode === 'register' ? 8 : 1,
                message: mode === 'register' ? 'At least 8 characters' : 'Enter your password',
              },
            ]"
            :extra="mode === 'register' ? 'At least 8 characters.' : undefined"
          >
            <a-input-password
              v-model:value="form.password"
              size="large"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
              placeholder="Your password"
            >
              <template #prefix><lock-outlined class="text-gray-500" /></template>
            </a-input-password>
          </a-form-item>
          <a-form-item
            v-if="mode === 'register'"
            label="Confirm password"
            name="confirm"
            :dependencies="['password']"
            :rules="[{ validator: checkConfirm }]"
          >
            <a-input-password v-model:value="form.confirm" size="large" autocomplete="new-password" placeholder="Type it again">
              <template #prefix><lock-outlined class="text-gray-500" /></template>
            </a-input-password>
          </a-form-item>

          <a-alert v-if="error" type="error" :message="error" show-icon class="mb-4!" />

          <a-button type="primary" html-type="submit" size="large" block :loading="submitting">
            {{ mode === 'login' ? 'Log in' : 'Create account' }}
          </a-button>
        </a-form>

        <div class="mt-5 flex flex-wrap items-center justify-center gap-1 text-sm text-gray-400">
          {{ mode === 'login' ? "Don't have an account?" : 'Already have an account?' }}
          <a-button type="link" size="small" class="px-1!" @click="toggleMode">
            {{ mode === 'login' ? 'Register' : 'Log in' }}
          </a-button>
        </div>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance } from 'ant-design-vue'
import type { RuleObject } from 'ant-design-vue/es/form'
import { BarChartOutlined, CloudSyncOutlined, LockOutlined, SkinOutlined, UserOutlined } from '@ant-design/icons-vue'
import { apiFetch } from '@/api/backend'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const features = [
  { icon: SkinOutlined, title: 'BiS Tracker', text: 'Plan gear sets per job and follow your relic and ultimate weapon progress.' },
  { icon: CloudSyncOutlined, title: 'Saved to your account', text: 'Favorites, dashboards and settings follow you between devices.' },
  { icon: BarChartOutlined, title: 'Logs Comparison', text: "Stack your FF Logs reports up against the world's top players." },
]

const mode = ref<'login' | 'register'>('login')
const formRef = ref<FormInstance>()
const form = reactive({ username: '', password: '', confirm: '' })

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

// The menu name of the page that sent here ("BiS Tracker"), to say what logging in leads to
const redirectLabel = computed(() => {
  if (redirect.value === '/') return null
  return router.resolve(redirect.value).matched.find((r) => r.meta.menuLabel)?.meta.menuLabel ?? null
})

const providers = ref({ google: false })
apiFetch<{ google: boolean }>('/auth/providers')
  .then((p) => (providers.value = p))
  .catch(console.error)

// A full-page navigation, not fetch: the server redirects the browser to Google
const googleHref = computed(() => `/api/auth/google?redirect=${encodeURIComponent(redirect.value)}`)

// Already signed in (e.g. opened /login from a bookmark): go straight on
auth.ensureLoaded().then(() => {
  if (auth.user) router.replace(redirect.value)
})

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
}

watch(mode, async () => {
  error.value = null
  form.confirm = ''
  // The password rule changes with the mode, so drop errors raised under the old one
  await nextTick()
  formRef.value?.clearValidate()
})

// Registering checks the server's rule (USERNAME_RE in server/index.ts) up front
const usernameRules = computed<RuleObject[]>(() => [
  { required: true, whitespace: true, message: 'Enter a username' },
  ...(mode.value === 'register'
    ? [{ pattern: /^\s*[\w.-]{3,32}\s*$/, message: '3-32 letters, numbers, dots, dashes or underscores' }]
    : []),
])

function checkConfirm(_rule: RuleObject, value: string) {
  if (!value) return Promise.reject('Confirm your password')
  return value === form.password ? Promise.resolve() : Promise.reject("Passwords don't match")
}

async function onSubmit() {
  error.value = null
  submitting.value = true
  try {
    await (mode.value === 'login' ? auth.login : auth.register)(form.username.trim(), form.password)
    router.replace(redirect.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    submitting.value = false
  }
}
</script>

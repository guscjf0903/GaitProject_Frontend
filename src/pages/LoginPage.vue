<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { AuthService } from '../api/generated'
import { ApiError } from '../api/generated'

const router = useRouter()
const auth = useAuthStore()

const email = ref('user@example.com')
const name = ref('홍길동')
const error = ref<string | null>(null)
const loading = ref(false)

async function login() {
  error.value = null
  loading.value = true
  try {
    // MVP: email 기반 로그인
    const res = await AuthService.login({ email: email.value })
    const data = (res as any).data
    if (!data?.accessToken || !data?.userId) {
      throw new Error('로그인 응답 형식이 예상과 다릅니다.')
    }
    auth.setAuth({ accessToken: data.accessToken, userId: data.userId })
    await router.push('/')
  } catch (e: any) {
    // 백엔드가 "가입된 유저만 로그인"이면 404가 날 수 있음 → 자동 signup 후 진행
    if (e instanceof ApiError && e.status === 404 && e.body?.code === 'NOT_FOUND') {
      try {
        const res = await AuthService.signup({ email: email.value, name: name.value || null })
        const data = (res as any).data
        if (!data?.accessToken || !data?.userId) {
          throw new Error('회원가입 응답 형식이 예상과 다릅니다.')
        }
        auth.setAuth({ accessToken: data.accessToken, userId: data.userId })
        await router.push('/')
        return
      } catch (e2: any) {
        error.value = e2?.message ?? '자동 회원가입 실패'
        return
      }
    }

    error.value = e?.message ?? '로그인 실패'
  } finally {
    loading.value = false
  }
}

async function signup() {
  error.value = null
  loading.value = true
  try {
    const res = await AuthService.signup({ email: email.value, name: name.value })
    const data = (res as any).data
    if (!data?.accessToken || !data?.userId) {
      throw new Error('회원가입 응답 형식이 예상과 다릅니다.')
    }
    auth.setAuth({ accessToken: data.accessToken, userId: data.userId })
    await router.push('/')
  } catch (e: any) {
    error.value = e?.message ?? '회원가입 실패'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="h-full w-full flex items-center justify-center p-6">
    <div class="w-[520px] max-w-[92vw] rounded-2xl border bg-[var(--sidebar)] shadow-2xl p-5"
         :style="{ borderColor: 'var(--border)' }">
      <div class="font-semibold mb-4">Login (MVP)</div>

      <label class="text-xs" :style="{ color: 'var(--muted)' }">Email</label>
      <input v-model="email"
             class="mt-2 w-full px-3 py-2 rounded-xl border bg-transparent outline-none focus:ring-1 focus:ring-brand-primary font-sans"
             :style="{ borderColor: 'var(--border)', color: 'var(--text)' }" />

      <label class="text-xs mt-4 block" :style="{ color: 'var(--muted)' }">Name (optional)</label>
      <input v-model="name"
             class="mt-2 w-full px-3 py-2 rounded-xl border bg-transparent outline-none focus:ring-1 focus:ring-brand-primary font-sans"
             :style="{ borderColor: 'var(--border)', color: 'var(--text)' }" />

      <div v-if="error" class="mt-3 text-xs text-red-500">{{ error }}</div>

      <div class="mt-5 flex justify-end gap-2">
        <button class="px-3 py-2 text-xs rounded-lg border hover:bg-[var(--itemHover)]"
                :style="{ borderColor: 'var(--border)' }"
                :disabled="loading"
                @click="signup">
          Signup
        </button>
        <button class="px-3 py-2 text-xs rounded-lg bg-brand-primary text-white hover:bg-purple-600"
                :disabled="loading"
                @click="login">
          Login
        </button>
      </div>
    </div>
  </div>
</template>


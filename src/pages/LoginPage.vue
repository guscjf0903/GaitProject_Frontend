<script setup lang="ts">
import { ref } from 'vue'
import { useAuthFlow } from '../features/auth/useAuthFlow'

const email = ref('user@example.com')
const name = ref('홍길동')
const { loading, errorMessage, login, signup } = useAuthFlow()
</script>

<template>
  <div class="flex h-full w-full items-center justify-center p-6">
    <div class="w-[520px] max-w-[92vw] rounded-2xl border bg-[var(--sidebar)] p-5 shadow-2xl" :style="{ borderColor: 'var(--border)' }">
      <div class="mb-4 font-semibold">Login (MVP)</div>

      <label class="text-xs" :style="{ color: 'var(--muted)' }">Email</label>
      <input
        v-model="email"
        class="mt-2 w-full rounded-xl border bg-transparent px-3 py-2 font-sans outline-none focus:ring-1 focus:ring-brand-primary"
        :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
      />

      <label class="mt-4 block text-xs" :style="{ color: 'var(--muted)' }">Name (optional)</label>
      <input
        v-model="name"
        class="mt-2 w-full rounded-xl border bg-transparent px-3 py-2 font-sans outline-none focus:ring-1 focus:ring-brand-primary"
        :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
      />

      <div v-if="errorMessage" class="mt-3 text-xs text-red-500">{{ errorMessage }}</div>

      <div class="mt-5 flex justify-end gap-2">
        <button
          class="rounded-lg border px-3 py-2 text-xs hover:bg-[var(--itemHover)]"
          :style="{ borderColor: 'var(--border)' }"
          :disabled="loading"
          @click="signup(email, name)"
        >
          Signup
        </button>
        <button
          class="rounded-lg bg-brand-primary px-3 py-2 text-xs text-white hover:bg-purple-600"
          :disabled="loading"
          @click="login(email, name)"
        >
          Login
        </button>
      </div>
    </div>
  </div>
</template>

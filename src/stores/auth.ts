import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const ACCESS_TOKEN_KEY = 'gait_access_token'
const USER_ID_KEY = 'gait_user_id'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY))
  const userId = ref<string | null>(localStorage.getItem(USER_ID_KEY))

  const isAuthed = computed(() => Boolean(accessToken.value && userId.value))

  function setAuth(payload: { accessToken: string; userId: string }) {
    accessToken.value = payload.accessToken
    userId.value = payload.userId
    localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken)
    localStorage.setItem(USER_ID_KEY, payload.userId)
  }

  function clear() {
    accessToken.value = null
    userId.value = null
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(USER_ID_KEY)
  }

  return { accessToken, userId, isAuthed, setAuth, clear }
})


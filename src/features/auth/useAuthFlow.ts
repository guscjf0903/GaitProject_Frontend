import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '../../api/generated'
import { extractApiErrorMessage, loginWithEmail, signupWithEmail } from '../../api/clients'
import { useAuthStore } from '../../stores/auth'
import { useProfileStore } from '../../stores/profile'

export function useAuthFlow() {
  const router = useRouter()
  const auth = useAuthStore()
  const profile = useProfileStore()

  const loading = ref(false)
  const errorMessage = ref<string | null>(null)

  async function applyAuth(accessToken: string, userId: string) {
    auth.setAuth({ accessToken, userId })
    await profile.fetchProfile().catch(() => undefined)
    await router.push('/')
  }

  async function login(email: string, name?: string) {
    errorMessage.value = null
    loading.value = true

    try {
      const token = await loginWithEmail(email)
      await applyAuth(token.accessToken, token.userId)
      return
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        try {
          const token = await signupWithEmail(email, name ?? null)
          await applyAuth(token.accessToken, token.userId)
          return
        } catch (signupError) {
          errorMessage.value = extractApiErrorMessage(signupError, '자동 회원가입 실패')
          return
        }
      }

      errorMessage.value = extractApiErrorMessage(error, '로그인 실패')
    } finally {
      loading.value = false
    }
  }

  async function signup(email: string, name?: string) {
    errorMessage.value = null
    loading.value = true

    try {
      const token = await signupWithEmail(email, name ?? null)
      await applyAuth(token.accessToken, token.userId)
    } catch (error) {
      errorMessage.value = extractApiErrorMessage(error, '회원가입 실패')
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    auth.clear()
    profile.reset()
    await router.push('/login')
  }

  return {
    loading,
    errorMessage,
    login,
    signup,
    logout,
  }
}

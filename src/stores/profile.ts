import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchUserProfile, type UserProfile } from '../api/clients'

export const useProfileStore = defineStore('profile', () => {
  const profile = ref<UserProfile | null>(null)
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)

  const planLabel = computed(() => profile.value?.plan ?? 'UNKNOWN')
  const usageLabel = computed(() => {
    if (!profile.value) return 'Profile unavailable'
    if (typeof profile.value.ragRemaining === 'number' && profile.value.ragDailyLimit > 0) {
      return `RAG ${profile.value.ragRemaining}/${profile.value.ragDailyLimit} left`
    }
    if (profile.value.premiumWalletCents > 0) {
      return `Wallet $${(profile.value.premiumWalletCents / 100).toFixed(2)}`
    }
    return `Cheap tokens ${profile.value.cheapTokensUsed}`
  })

  async function fetchProfile() {
    loading.value = true
    errorMessage.value = null
    try {
      profile.value = await fetchUserProfile()
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '프로필을 불러오지 못했습니다.'
      profile.value = null
    } finally {
      loading.value = false
    }
  }

  function reset() {
    profile.value = null
    errorMessage.value = null
    loading.value = false
  }

  return {
    profile,
    loading,
    errorMessage,
    planLabel,
    usageLabel,
    fetchProfile,
    reset,
  }
})

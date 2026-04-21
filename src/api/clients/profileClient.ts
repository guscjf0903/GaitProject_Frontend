import { apiFetchData } from './base'

export type UserProfile = {
  email: string
  name?: string | null
  plan: 'FREE' | 'STANDARD' | 'MASTER'
  ragCallsToday: number
  ragDailyLimit: number
  ragRemaining?: number | null
  cheapTokensUsed: number
  premiumWalletCents: number
}

export async function fetchUserProfile(): Promise<UserProfile> {
  return apiFetchData<UserProfile>('/api/users/me')
}

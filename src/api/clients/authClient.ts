import { AuthService } from '../generated'
import { requireData } from './base'

export type AuthTokenPayload = {
  accessToken: string
  userId: string
  tokenType?: string
}

export async function loginWithEmail(email: string): Promise<AuthTokenPayload> {
  const response = await AuthService.login({ email })
  return requireData(response.data as AuthTokenPayload | undefined, '로그인 응답 데이터가 없습니다.')
}

export async function signupWithEmail(email: string, name?: string | null): Promise<AuthTokenPayload> {
  const response = await AuthService.signup({ email, name: name ?? null })
  return requireData(response.data as AuthTokenPayload | undefined, '회원가입 응답 데이터가 없습니다.')
}

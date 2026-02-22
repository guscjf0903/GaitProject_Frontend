import { OpenAPI } from './generated'

export function configureApi() {
  OpenAPI.BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
  OpenAPI.TOKEN = async () => {
    // keep it simple + robust across app init order
    return localStorage.getItem('gait_access_token') ?? ''
  }

  // Safety net: 강제로 Authorization 헤더를 추가 (localStorage 기반)
  // - OpenAPI.TOKEN이 꼬이거나 초기화 타이밍 이슈가 있어도 403을 방지
  OpenAPI.HEADERS = async () => {
    const token = localStorage.getItem('gait_access_token')
    return (token ? { Authorization: `Bearer ${token}` } : {}) as Record<string, string>
  }
}


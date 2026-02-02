import { OpenAPI } from './generated'
import { useAuthStore } from '../stores/auth'

export function configureApi() {
  OpenAPI.BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
  OpenAPI.TOKEN = async () => {
    const auth = useAuthStore()
    return auth.accessToken ?? ''
  }
}


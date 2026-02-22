import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../pages/LoginPage.vue'
import WorkspacePage from '../pages/WorkspacePage.vue'
import ChatPage from '../pages/ChatPage.vue'

const ACCESS_TOKEN_KEY = 'gait_access_token'
const USER_ID_KEY = 'gait_user_id'
const isAuthed = () => Boolean(localStorage.getItem(ACCESS_TOKEN_KEY) && localStorage.getItem(USER_ID_KEY))

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: WorkspacePage, meta: { requiresAuth: true } },
    { path: '/login', name: 'login', component: LoginPage },
    { path: '/w/:workspaceId/b/:branchId', name: 'chat', component: ChatPage, props: true, meta: { requiresAuth: true } },
  ],
})

router.beforeEach((to) => {
  const authed = isAuthed()
  if (to.name === 'login' && authed) return { name: 'home' }
  if (to.meta?.requiresAuth && !authed) return { name: 'login' }
  return true
})


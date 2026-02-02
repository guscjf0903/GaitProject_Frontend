import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../pages/LoginPage.vue'
import WorkspacePage from '../pages/WorkspacePage.vue'
import ChatPage from '../pages/ChatPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: WorkspacePage },
    { path: '/login', name: 'login', component: LoginPage },
    { path: '/w/:workspaceId/b/:branchId', name: 'chat', component: ChatPage, props: true },
  ],
})


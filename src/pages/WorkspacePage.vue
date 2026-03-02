<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { BranchesService, UsersService, WorkspacesService } from '../api/generated'

const router = useRouter()
const auth = useAuthStore()

const loading = ref(false)
const error = ref<string | null>(null)

const workspaces = ref<Array<{ id: string; name: string }>>([])
const branches = ref<Array<{ id: string; name: string }>>([])
const selectedWorkspaceId = ref<string | null>(null)

const newWorkspaceName = ref('My Workspace')

async function loadWorkspaces() {
  if (!auth.isAuthed) {
    await router.push('/login')
    return
  }
  loading.value = true
  error.value = null
  try {
    const res = await UsersService.list1(auth.userId as string)
    workspaces.value = (res.data ?? []).map((w: any) => ({ id: w.id, name: w.name }))
  } catch (e: any) {
    error.value = e?.message ?? '워크스페이스 조회 실패'
  } finally {
    loading.value = false
  }
}

async function selectWorkspace(workspaceId: string) {
  selectedWorkspaceId.value = workspaceId
  loading.value = true
  error.value = null
  try {
    const res = await BranchesService.listByWorkspace(workspaceId)
    branches.value = (res.data ?? []).map((b: any) => ({ id: b.id, name: b.name }))
  } catch (e: any) {
    error.value = e?.message ?? '브랜치 목록 조회 실패'
  } finally {
    loading.value = false
  }
}

async function createMainBranch() {
  if (!selectedWorkspaceId.value) return
  loading.value = true
  error.value = null
  try {
    await BranchesService.create2(selectedWorkspaceId.value, {
      // backend DTO has @NotNull validation; it gets overwritten by path variable anyway
      workspaceId: selectedWorkspaceId.value,
      name: 'main',
      description: '기본 브랜치',
      isDefault: true,
    })
    await selectWorkspace(selectedWorkspaceId.value)
  } catch (e: any) {
    error.value = e?.message ?? 'main 브랜치 생성 실패'
  } finally {
    loading.value = false
  }
}

async function createWorkspace() {
  if (!auth.isAuthed) {
    await router.push('/login')
    return
  }
  loading.value = true
  error.value = null
  try {
    const res = await WorkspacesService.create({
      userId: auth.userId as string,
      name: newWorkspaceName.value,
      description: null,
    })
    const ws: any = res.data
    if (!ws?.id) throw new Error('워크스페이스 생성 응답 형식이 예상과 다릅니다.')
    await loadWorkspaces()
    await selectWorkspace(ws.id)
  } catch (e: any) {
    error.value = e?.message ?? '워크스페이스 생성 실패'
  } finally {
    loading.value = false
  }
}

async function goChat(branchId: string) {
  if (!selectedWorkspaceId.value) return
  await router.push(`/w/${selectedWorkspaceId.value}/b/${branchId}`)
}

async function logout() {
  auth.clear()
  await router.push('/login')
}

onMounted(() => {
  void loadWorkspaces()
})
</script>

<template>
  <div class="h-full w-full flex items-center justify-center p-6">
    <div class="w-[520px] max-w-[92vw] rounded-2xl border bg-[var(--sidebar)] shadow-2xl p-5"
         :style="{ borderColor: 'var(--border)' }">
      <div class="flex items-center justify-between mb-1">
        <div class="font-semibold">Workspace</div>
        <button
          @click="logout"
          class="px-2 py-1 text-xs rounded border border-red-500/30 text-red-500 hover:bg-red-500/10 transition"
        >
          Logout
        </button>
      </div>
      <div class="text-xs mb-3" :style="{ color: 'var(--muted)' }">userId: {{ auth.userId ?? 'not logged in' }}</div>

      <div class="flex gap-2">
        <input
          v-model="newWorkspaceName"
          class="flex-1 px-3 py-2 rounded-xl border bg-transparent outline-none focus:ring-1 focus:ring-brand-primary"
          :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
          placeholder="New workspace name"
        />
        <button class="px-3 py-2 text-xs rounded-lg bg-brand-primary text-white hover:bg-purple-600"
                :disabled="loading"
                @click="createWorkspace">
          Create
        </button>
      </div>

      <div v-if="error" class="mt-3 text-xs text-red-500">{{ error }}</div>

      <div class="mt-4">
        <div class="text-xs font-bold mb-2" :style="{ color: 'var(--muted)' }">Workspaces</div>
        <div class="space-y-2">
          <button
            v-for="w in workspaces"
            :key="w.id"
            class="w-full text-left px-3 py-2 rounded-lg border hover:bg-[var(--itemHover)] transition"
            :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
            @click="selectWorkspace(w.id)"
          >
            {{ w.name }}
          </button>
        </div>
      </div>

      <div v-if="selectedWorkspaceId" class="mt-4">
        <div class="text-xs font-bold mb-2" :style="{ color: 'var(--muted)' }">Branches</div>
        <div class="space-y-2">
          <button
            v-for="b in branches"
            :key="b.id"
            class="w-full text-left px-3 py-2 rounded-lg border hover:bg-[var(--itemHover)] transition"
            :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
            @click="goChat(b.id)"
          >
            {{ b.name }}
          </button>
        </div>

        <div v-if="branches.length === 0" class="mt-2">
          <div class="text-xs mb-2" :style="{ color: 'var(--muted)' }">브랜치가 아직 없어요.</div>
          <button
            class="px-3 py-2 text-xs rounded-lg bg-brand-primary text-white hover:bg-purple-600"
            :disabled="loading"
            @click="createMainBranch"
          >
            Create main branch
          </button>
        </div>
      </div>
    </div>
  </div>
</template>


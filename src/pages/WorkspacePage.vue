<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createBranch, createWorkspace, extractApiErrorMessage, listUserWorkspaces, listWorkspaceBranches } from '../api/clients'
import { useAuthStore } from '../stores/auth'
import { useProfileStore } from '../stores/profile'

const router = useRouter()
const auth = useAuthStore()
const profile = useProfileStore()

const loading = ref(false)
const errorMessage = ref<string | null>(null)
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
  errorMessage.value = null

  try {
    const result = await listUserWorkspaces(auth.userId as string)
    workspaces.value = result.map((workspace) => ({ id: String(workspace.id), name: workspace.name }))
  } catch (error) {
    errorMessage.value = extractApiErrorMessage(error, '워크스페이스 조회 실패')
  } finally {
    loading.value = false
  }
}

async function selectWorkspace(workspaceId: string) {
  selectedWorkspaceId.value = workspaceId
  loading.value = true
  errorMessage.value = null

  try {
    const result = await listWorkspaceBranches(workspaceId)
    branches.value = result.map((branch) => ({ id: String(branch.id), name: branch.name }))
  } catch (error) {
    errorMessage.value = extractApiErrorMessage(error, '브랜치 목록 조회 실패')
  } finally {
    loading.value = false
  }
}

async function createMainBranch() {
  if (!selectedWorkspaceId.value) return

  loading.value = true
  errorMessage.value = null

  try {
    await createBranch(selectedWorkspaceId.value, {
      workspaceId: selectedWorkspaceId.value,
      name: 'main',
      description: '기본 브랜치',
      isDefault: true,
    })
    await selectWorkspace(selectedWorkspaceId.value)
  } catch (error) {
    errorMessage.value = extractApiErrorMessage(error, 'main 브랜치 생성 실패')
  } finally {
    loading.value = false
  }
}

async function createWorkspaceAndSelect() {
  if (!auth.isAuthed) {
    await router.push('/login')
    return
  }

  loading.value = true
  errorMessage.value = null

  try {
    const workspace = await createWorkspace({
      userId: auth.userId as string,
      name: newWorkspaceName.value,
      description: null,
    })

    if (!workspace.id) {
      throw new Error('워크스페이스 생성 응답 형식이 예상과 다릅니다.')
    }

    await loadWorkspaces()
    await selectWorkspace(String(workspace.id))
  } catch (error) {
    errorMessage.value = extractApiErrorMessage(error, '워크스페이스 생성 실패')
  } finally {
    loading.value = false
  }
}

async function goChat(targetBranchId: string) {
  if (!selectedWorkspaceId.value) return
  await router.push(`/w/${selectedWorkspaceId.value}/b/${targetBranchId}`)
}

async function logout() {
  auth.clear()
  profile.reset()
  await router.push('/login')
}

onMounted(() => {
  void loadWorkspaces()
  if (auth.isAuthed) {
    void profile.fetchProfile()
  }
})
</script>

<template>
  <div class="flex h-full w-full items-center justify-center p-6">
    <div class="w-[520px] max-w-[92vw] rounded-2xl border bg-[var(--sidebar)] p-5 shadow-2xl" :style="{ borderColor: 'var(--border)' }">
      <div class="mb-1 flex items-center justify-between">
        <div class="font-semibold">Workspace</div>
        <button
          class="rounded border border-red-500/30 px-2 py-1 text-xs text-red-500 transition hover:bg-red-500/10"
          @click="logout"
        >
          Logout
        </button>
      </div>

      <div class="mb-3 text-xs" :style="{ color: 'var(--muted)' }">userId: {{ auth.userId ?? 'not logged in' }}</div>

      <div class="flex gap-2">
        <input
          v-model="newWorkspaceName"
          class="flex-1 rounded-xl border bg-transparent px-3 py-2 outline-none focus:ring-1 focus:ring-brand-primary"
          :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
          placeholder="New workspace name"
        />
        <button
          class="rounded-lg bg-brand-primary px-3 py-2 text-xs text-white hover:bg-purple-600"
          :disabled="loading"
          @click="createWorkspaceAndSelect"
        >
          Create
        </button>
      </div>

      <div v-if="errorMessage" class="mt-3 text-xs text-red-500">{{ errorMessage }}</div>

      <div class="mt-4">
        <div class="mb-2 text-xs font-bold" :style="{ color: 'var(--muted)' }">Workspaces</div>
        <div class="space-y-2">
          <button
            v-for="workspace in workspaces"
            :key="workspace.id"
            class="w-full rounded-lg border px-3 py-2 text-left transition hover:bg-[var(--itemHover)]"
            :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
            @click="selectWorkspace(workspace.id)"
          >
            {{ workspace.name }}
          </button>
        </div>
      </div>

      <div v-if="selectedWorkspaceId" class="mt-4">
        <div class="mb-2 text-xs font-bold" :style="{ color: 'var(--muted)' }">Branches</div>
        <div class="space-y-2">
          <button
            v-for="branch in branches"
            :key="branch.id"
            class="w-full rounded-lg border px-3 py-2 text-left transition hover:bg-[var(--itemHover)]"
            :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
            @click="goChat(branch.id)"
          >
            {{ branch.name }}
          </button>
        </div>

        <div v-if="branches.length === 0" class="mt-2">
          <div class="mb-2 text-xs" :style="{ color: 'var(--muted)' }">브랜치가 아직 없어요.</div>
          <button
            class="rounded-lg bg-brand-primary px-3 py-2 text-xs text-white hover:bg-purple-600"
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

<script setup lang="ts">
import moment from 'moment'
import { reactive, ref } from 'vue'
import type { ValidatedError } from '@arco-design/web-vue'
import { useCreateApp, useGetAppsWithPage } from '@/hooks/use-app'

const createModalVisible = ref(false)
const formRef = ref()
const form = reactive({
  name: '',
  icon: '',
  description: '',
})
const { loading, apps, paginator, loadApps } = useGetAppsWithPage()
const { loading: createLoading, handleCreateApp } = useCreateApp()

const handleScroll = async (event: UIEvent) => {
  const { scrollTop, scrollHeight, clientHeight } = event.target as HTMLElement
  if (scrollTop + clientHeight >= scrollHeight - 10 && !loading.value) {
    await loadApps()
  }
}

const handleCancel = () => {
  createModalVisible.value = false
  formRef.value?.resetFields()
}

const handleSubmit = async ({ errors }: { errors: Record<string, ValidatedError> | undefined }) => {
  if (errors) return
  await handleCreateApp({ ...form })
}
</script>

<template>
  <a-spin
    :loading="loading"
    class="block h-full w-full scrollbar-w-none overflow-scroll"
    @scroll="handleScroll"
  >
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="text-xl font-bold text-gray-800">AI 应用</div>
        <div class="text-sm text-gray-500 mt-1">创建、配置并调试你的 Agent 应用</div>
      </div>
      <a-button type="primary" class="rounded-lg" @click="createModalVisible = true">
        <template #icon>
          <icon-plus />
        </template>
        新建应用
      </a-button>
    </div>

    <a-row :gutter="[20, 20]" class="flex-1">
      <a-col v-for="app in apps" :key="app.id" :span="6">
        <router-link :to="{ name: 'space-apps-detail', params: { app_id: app.id } }">
          <a-card hoverable class="cursor-pointer rounded-lg h-full">
            <div class="flex items-center gap-3 mb-3">
              <a-avatar :size="40" shape="square" class="rounded-lg bg-blue-700" :image-url="app.icon">
                <icon-apps />
              </a-avatar>
              <div class="min-w-0">
                <div class="text-base text-gray-900 font-bold truncate">{{ app.name }}</div>
                <div class="text-xs text-gray-500">{{ app.status === 'draft' ? '草稿' : '已发布' }}</div>
              </div>
            </div>
            <div class="leading-[18px] text-gray-500 h-[72px] line-clamp-4 mb-2 break-all">
              {{ app.description || '暂无应用描述' }}
            </div>
            <div class="flex items-center gap-1.5 text-xs text-gray-400">
              <icon-schedule />
              最近编辑 {{ moment(app.updated_at * 1000).format('MM-DD HH:mm') }}
            </div>
          </a-card>
        </router-link>
      </a-col>
      <a-col v-if="apps.length === 0" :span="24">
        <a-empty description="没有可用的 AI 应用" class="h-[400px] flex flex-col items-center justify-center">
          <template #extra>
            <a-button type="primary" @click="createModalVisible = true">新建应用</a-button>
          </template>
        </a-empty>
      </a-col>
    </a-row>

    <a-row v-if="paginator.total_page >= 2">
      <a-col v-if="paginator.current_page <= paginator.total_page" :span="24" align="center">
        <a-space class="my-4">
          <a-spin />
          <div class="text-gray-400">加载中</div>
        </a-space>
      </a-col>
      <a-col v-else :span="24" align="center">
        <div class="text-gray-400 my-4">数据已加载完成</div>
      </a-col>
    </a-row>

    <a-modal
      :width="520"
      v-model:visible="createModalVisible"
      hide-title
      :footer="false"
      modal-class="rounded-xl"
      @cancel="handleCancel"
    >
      <div class="flex items-center justify-between">
        <div class="text-lg font-bold text-gray-700">新建 AI 应用</div>
        <a-button type="text" class="!text-gray-700" size="small" @click="handleCancel">
          <template #icon>
            <icon-close />
          </template>
        </a-button>
      </div>
      <div class="pt-6">
        <a-form ref="formRef" :model="form" layout="vertical" @submit="handleSubmit">
          <a-form-item
            field="name"
            label="应用名称"
            asterisk-position="end"
            :rules="[{ required: true, message: '应用名称不能为空' }]"
          >
            <a-input v-model="form.name" placeholder="请输入应用名称" show-word-limit :max-length="60" />
          </a-form-item>
          <a-form-item field="icon" label="应用图标 URL">
            <a-input v-model="form.icon" placeholder="可选，留空使用默认图标" />
          </a-form-item>
          <a-form-item field="description" label="应用描述">
            <a-textarea
              v-model="form.description"
              :auto-size="{ minRows: 4, maxRows: 6 }"
              placeholder="请输入应用用途描述"
            />
          </a-form-item>
          <div class="flex items-center justify-between">
            <div></div>
            <a-space :size="16">
              <a-button class="rounded-lg" @click="handleCancel">取消</a-button>
              <a-button :loading="createLoading" type="primary" html-type="submit" class="rounded-lg">
                创建
              </a-button>
            </a-space>
          </div>
        </a-form>
      </div>
    </a-modal>
  </a-spin>
</template>

<style scoped></style>

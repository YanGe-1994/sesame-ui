import { get, post } from '@/utils/request'
import { type AuthorizeResponse, type ProviderResponse } from '@/models/oauth'
import { useCredentialStore } from '@/stores/credential'

// 获取指定第三方授权服务的重定向地址
export const provider = (provider_name: string) => {
  return get<ProviderResponse>(`/oauth/${provider_name}`)
}

// 指定第三方授权服务认证地址
export const authorize = (provider_name: string, code: string) => {
  useCredentialStore().ensureDeviceId()
  return post<AuthorizeResponse>(`/oauth/authorize/${provider_name}`, {
    body: { code },
    skipRefresh: true,
  })
}

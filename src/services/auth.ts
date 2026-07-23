import { post } from '@/utils/request'
import { type BaseResponse } from '@/models/base'
import { type PasswordLoginResponse } from '@/models/auth'
import { useCredentialStore } from '@/stores/credential'

// 账号密码登录请求
export const passwordLogin = (email: string, password: string) => {
  useCredentialStore().ensureDeviceId()
  return post<PasswordLoginResponse>(`/auth/password-login`, {
    body: { email, password },
    skipRefresh: true,
  })
}

// 退出登录请求
export const logout = () => {
  return post<BaseResponse<any>>(`/auth/logout`)
}

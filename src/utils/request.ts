import { Message } from '@arco-design/web-vue'
import { apiPrefix, httpCode } from '@/config'
import { useCredentialStore } from '@/stores/credential'
import { useAccountStore } from '@/stores/account'
import router from '@/router'

const TIME_OUT = 100000

const baseFetchOptions = {
  method: 'GET',
  mode: 'cors',
  credentials: 'include',
  headers: new Headers({
    'Content-Type': 'application/json',
  }),
  redirect: 'follow',
}

type FetchOptionType = Omit<RequestInit, 'body'> & {
  params?: Record<string, any>
  body?: BodyInit | Record<string, any> | null
  skipRefresh?: boolean
}

let refreshPromise: Promise<boolean> | null = null

const buildHeaders = (headers?: HeadersInit) => new Headers(headers || baseFetchOptions.headers)

const attachAuthHeaders = (headers: Headers) => {
  const credentialStore = useCredentialStore()
  const accessToken = credentialStore.credential.access_token
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  headers.set('X-Device-Id', credentialStore.ensureDeviceId())
}

const clearLoginState = async () => {
  useCredentialStore().clear()
  useAccountStore().clear()
  await router.replace({ path: '/auth/login' })
}

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const credentialStore = useCredentialStore()
      const headers = new Headers({ 'Content-Type': 'application/json' })
      headers.set('X-Device-Id', credentialStore.ensureDeviceId())
      const response = await globalThis.fetch(`${apiPrefix}/auth/refresh`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers,
      } as RequestInit)
      const json = await response.json()
      if (json.code === httpCode.success) {
        credentialStore.update(json.data)
        return true
      }
      return false
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

const normalizeOptions = (fetchOptions: FetchOptionType) => {
  const options: typeof baseFetchOptions & FetchOptionType = Object.assign(
    {},
    baseFetchOptions,
    fetchOptions,
  )
  options.headers = buildHeaders(fetchOptions.headers)
  attachAuthHeaders(options.headers)
  return options
}

const baseFetch = <T>(url: string, fetchOptions: FetchOptionType): Promise<T> => {
  const execute = async (allowRefresh: boolean): Promise<T> => {
    const options = normalizeOptions(fetchOptions)
    let urlWithPrefix = `${apiPrefix}${url.startsWith('/') ? url : `/${url}`}`
    const { method, params, body } = options

    if (method === 'GET' && params) {
      const paramsArray: string[] = []
      Object.keys(params).forEach((key) => {
        paramsArray.push(`${key}=${encodeURIComponent(params[key])}`)
      })
      if (urlWithPrefix.search(/\?/) === -1) {
        urlWithPrefix += `?${paramsArray.join('&')}`
      } else {
        urlWithPrefix += `&${paramsArray.join('&')}`
      }
      delete options.params
    }

    if (body) options.body = typeof body === 'string' ? body : JSON.stringify(body)

    const json = await Promise.race([
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('接口已超时')), TIME_OUT)
      }),
      globalThis.fetch(urlWithPrefix, options as RequestInit).then((res) => res.json()),
    ]) as any

    if (json.code === httpCode.success) return json
    if (json.code === httpCode.unauthorized) {
      if (allowRefresh && !fetchOptions.skipRefresh && await refreshAccessToken()) {
        return execute(false)
      }
      await clearLoginState()
      throw new Error(json.message)
    }
    Message.error(json.message)
    throw new Error(json.message)
  }

  return execute(true)
}

export const ssePost = async (
  url: string,
  fetchOptions: FetchOptionType,
  onData: (data: { [key: string]: any }) => void,
) => {
  const execute = async (allowRefresh: boolean): Promise<void> => {
    const options = normalizeOptions(Object.assign({}, fetchOptions, { method: 'POST' }))
    const urlWithPrefix = `${apiPrefix}${url.startsWith('/') ? url : `/${url}`}`
    const { body } = fetchOptions
    if (body) options.body = typeof body === 'string' ? body : JSON.stringify(body)

    const response = await globalThis.fetch(urlWithPrefix, options as RequestInit)
    if (!response.ok) {
      if (allowRefresh && response.status === 401 && await refreshAccessToken()) {
        return execute(false)
      }
      await clearLoginState()
      throw new Error('网络请求失败')
    }
    return await handleStream(response, onData)
  }

  return execute(true)
}

const handleStream = (
  response: Response,
  onData: (data: Record<string, any>) => void,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    const read = () => {
      reader?.read().then((result: any) => {
        if (result.done) {
          resolve()
          return
        }

        buffer += decoder.decode(result.value, { stream: true })
        const lines = buffer.split('\n')

        let event = ''
        let data = ''

        try {
          lines.forEach((line) => {
            line = line.trim()
            if (line.startsWith('event:')) {
              event = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              data = line.slice(5).trim()
            }

            if (line === '') {
              if (event !== '' && data !== '') {
                onData({
                  event: event,
                  data: JSON.parse(data),
                })
                event = ''
                data = ''
              }
            }
          })
          buffer = lines.pop() || ''
        } catch (e) {
          reject(e)
        }

        read()
      })
    }

    read()
  })
}

export const upload = <T>(url: string, options: any = {}): Promise<T> => {
  const execute = async (allowRefresh: boolean): Promise<T> => {
    const urlWithPrefix = `${apiPrefix}${url.startsWith('/') ? url : `/${url}`}`
    const defaultOptions = {
      method: 'POST',
      url: urlWithPrefix,
      headers: {},
      data: {},
    }
    const xhrOptions = {
      ...defaultOptions,
      ...options,
      headers: { ...defaultOptions.headers, ...options.headers },
    }
    const credentialStore = useCredentialStore()
    const accessToken = credentialStore.credential.access_token
    if (accessToken) xhrOptions.headers['Authorization'] = `Bearer ${accessToken}`
    xhrOptions.headers['X-Device-Id'] = credentialStore.ensureDeviceId()

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(xhrOptions.method, xhrOptions.url)
      for (const key in xhrOptions.headers) {
        xhr.setRequestHeader(key, xhrOptions.headers[key])
      }
      xhr.withCredentials = true
      xhr.responseType = 'json'

      xhr.onreadystatechange = async () => {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            const response = xhr.response
            if (response.code === httpCode.success) {
              resolve(response)
            } else if (response.code === httpCode.unauthorized) {
              if (allowRefresh && await refreshAccessToken()) {
                resolve(await execute(false))
                return
              }
              await clearLoginState()
              reject(new Error(response.message))
            } else {
              reject(xhr.response)
            }
          } else {
            reject(xhr)
          }
        }
      }

      xhr.upload.onprogress = xhrOptions.onprogress
      xhr.send(xhrOptions.data)
    })
  }

  return execute(true)
}

export const request = <T>(url: string, options = {}) => {
  return baseFetch<T>(url, options)
}

export const get = <T>(url: string, options = {}) => {
  return request<T>(url, Object.assign({}, options, { method: 'GET' }))
}

export const post = <T>(url: string, options = {}) => {
  return request<T>(url, Object.assign({}, options, { method: 'POST' }))
}

import { ref } from 'vue'
import { defineStore } from 'pinia'
import storage from '@/utils/storage'

const deviceIdKey = 'device_id'

const initCredential = {
  access_token: '',
  expire_at: 0,
}

const generateDeviceId = () => {
  if (crypto?.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const useCredentialStore = defineStore('credential', () => {
  const credential = ref(storage.get('credential', initCredential))

  const ensureDeviceId = () => {
    let deviceId = storage.get(deviceIdKey)
    if (!deviceId) {
      deviceId = generateDeviceId()
      storage.set(deviceIdKey, deviceId)
    }
    return deviceId
  }

  const update = (params: any) => {
    credential.value = {
      access_token: params.access_token || '',
      expire_at: params.expire_at || 0,
    }
    storage.set('credential', credential.value)
  }

  const clear = () => {
    credential.value = initCredential
    storage.remove('credential')
  }

  return { credential, update, clear, ensureDeviceId }
})

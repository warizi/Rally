/**
 * 알림 설정 store (현재 사용처: 타이머 알림 사운드 선택).
 *
 * 사운드 키만 영속 — 실제 URL 은 entities/timer/sounds 에서 key → url 매핑.
 * localStorage 사용 (단순한 user preference, IPC 통한 main 설정에 둘 만큼 무겁지 않음).
 */
import { create } from 'zustand'
import { DEFAULT_ALARM_SOUND_KEY } from '@/entities/timer'

const STORAGE_KEY = 'rally:alarm-sound-key'

interface AlarmSettingsStore {
  alarmSoundKey: string
  setAlarmSoundKey: (key: string) => void
}

function loadInitialKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_ALARM_SOUND_KEY
  } catch {
    return DEFAULT_ALARM_SOUND_KEY
  }
}

export const useAlarmSettingsStore = create<AlarmSettingsStore>()((set) => ({
  alarmSoundKey: loadInitialKey(),
  setAlarmSoundKey: (key: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, key)
    } catch {
      /* ignore */
    }
    set({ alarmSoundKey: key })
  }
}))

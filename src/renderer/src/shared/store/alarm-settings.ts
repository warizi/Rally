/**
 * 알림 설정 store (현재 사용처: 타이머 알림 사운드 선택).
 *
 * 사운드 키만 영속 — 실제 URL 은 entities/timer/sounds 에서 key → url 매핑.
 * localStorage 사용 (단순한 user preference, IPC 통한 main 설정에 둘 만큼 무겁지 않음).
 */
import { create } from 'zustand'
import { DEFAULT_ALARM_SOUND_KEY } from '@/entities/timer'

const STORAGE_KEY = 'rally:alarm-sound-key'
const REPEAT_STORAGE_KEY = 'rally:alarm-repeat'
/** 반복 재생 시 사이 간격 (ms). */
export const ALARM_REPEAT_INTERVAL_MS = 2_000

interface AlarmSettingsStore {
  alarmSoundKey: string
  /** true = 반복 재생 (2초 간격), false = 한 번만 재생. */
  alarmRepeat: boolean
  setAlarmSoundKey: (key: string) => void
  setAlarmRepeat: (repeat: boolean) => void
}

function loadInitialKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_ALARM_SOUND_KEY
  } catch {
    return DEFAULT_ALARM_SOUND_KEY
  }
}

function loadInitialRepeat(): boolean {
  try {
    // 기본값: 반복 재생 활성 (사용자가 알림을 놓치지 않도록)
    const v = localStorage.getItem(REPEAT_STORAGE_KEY)
    if (v === null) return true
    return v === '1'
  } catch {
    return true
  }
}

export const useAlarmSettingsStore = create<AlarmSettingsStore>()((set) => ({
  alarmSoundKey: loadInitialKey(),
  alarmRepeat: loadInitialRepeat(),
  setAlarmSoundKey: (key: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, key)
    } catch {
      /* ignore */
    }
    set({ alarmSoundKey: key })
  },
  setAlarmRepeat: (repeat: boolean) => {
    try {
      localStorage.setItem(REPEAT_STORAGE_KEY, repeat ? '1' : '0')
    } catch {
      /* ignore */
    }
    set({ alarmRepeat: repeat })
  }
}))

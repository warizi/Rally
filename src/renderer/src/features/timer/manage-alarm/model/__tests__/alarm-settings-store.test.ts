/**
 * features/timer/manage-alarm/model/alarm-settings-store.test.ts
 *
 * localStorage 영속 + 기본값 fallback. localStorage 가 throw 해도 무시.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

describe('useAlarmSettingsStore — initial load', () => {
  it('localStorage 비어있으면 DEFAULT_ALARM_SOUND_KEY + repeat=true', async () => {
    const { useAlarmSettingsStore } = await import('../alarm-settings-store')
    const { DEFAULT_ALARM_SOUND_KEY } = await import('@/entities/timer')
    const s = useAlarmSettingsStore.getState()
    expect(s.alarmSoundKey).toBe(DEFAULT_ALARM_SOUND_KEY)
    expect(s.alarmRepeat).toBe(true)
  })

  it('localStorage 에 저장된 값 → 복원', async () => {
    localStorage.setItem('rally:alarm-sound-key', 'bell')
    localStorage.setItem('rally:alarm-repeat', '0')
    const { useAlarmSettingsStore } = await import('../alarm-settings-store')
    const s = useAlarmSettingsStore.getState()
    expect(s.alarmSoundKey).toBe('bell')
    expect(s.alarmRepeat).toBe(false)
  })

  it('localStorage 가 throw → fallback 기본값', async () => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = (): string => {
      throw new Error('boom')
    }
    try {
      const { useAlarmSettingsStore } = await import('../alarm-settings-store')
      const { DEFAULT_ALARM_SOUND_KEY } = await import('@/entities/timer')
      const s = useAlarmSettingsStore.getState()
      expect(s.alarmSoundKey).toBe(DEFAULT_ALARM_SOUND_KEY)
      expect(s.alarmRepeat).toBe(true)
    } finally {
      Storage.prototype.getItem = orig
    }
  })
})

describe('setAlarmSoundKey / setAlarmRepeat', () => {
  it('setAlarmSoundKey → state + localStorage 갱신', async () => {
    const { useAlarmSettingsStore } = await import('../alarm-settings-store')
    useAlarmSettingsStore.getState().setAlarmSoundKey('chime')
    expect(useAlarmSettingsStore.getState().alarmSoundKey).toBe('chime')
    expect(localStorage.getItem('rally:alarm-sound-key')).toBe('chime')
  })

  it('setAlarmRepeat → state + localStorage 갱신 (true → "1", false → "0")', async () => {
    const { useAlarmSettingsStore } = await import('../alarm-settings-store')
    useAlarmSettingsStore.getState().setAlarmRepeat(false)
    expect(useAlarmSettingsStore.getState().alarmRepeat).toBe(false)
    expect(localStorage.getItem('rally:alarm-repeat')).toBe('0')
    useAlarmSettingsStore.getState().setAlarmRepeat(true)
    expect(localStorage.getItem('rally:alarm-repeat')).toBe('1')
  })

  it('localStorage.setItem throw → state 만 갱신 (silent)', async () => {
    const { useAlarmSettingsStore } = await import('../alarm-settings-store')
    const orig = Storage.prototype.setItem
    Storage.prototype.setItem = (): void => {
      throw new Error('quota')
    }
    try {
      useAlarmSettingsStore.getState().setAlarmSoundKey('new-key')
      expect(useAlarmSettingsStore.getState().alarmSoundKey).toBe('new-key')
    } finally {
      Storage.prototype.setItem = orig
    }
  })
})

/**
 * entities/timer/model/sounds.test.ts
 */
import { describe, it, expect, vi } from 'vitest'

// mp3 imports
vi.mock('@/shared/sound/생명유지장치알림소리-삐-삐-삐.mp3?url', () => ({ default: 's1.mp3' }))
vi.mock('@/shared/sound/알림소리-꼬꼬덱-꼭.mp3?url', () => ({ default: 's2.mp3' }))
vi.mock('@/shared/sound/알림소리-방사능.mp3?url', () => ({ default: 's3.mp3' }))
vi.mock('@/shared/sound/알림소리-삐비-.mp3?url', () => ({ default: 's4.mp3' }))
vi.mock('@/shared/sound/알림소리-삐삐-삐삐.mp3?url', () => ({ default: 's5.mp3' }))
vi.mock('@/shared/sound/알림소리-삐삐삐삐.mp3?url', () => ({ default: 's6.mp3' }))
vi.mock('@/shared/sound/알림소리-자명종.mp3?url', () => ({ default: 's7.mp3' }))
vi.mock('@/shared/sound/탁상시계알림소리-삐삐삐삐.mp3?url', () => ({ default: 's8.mp3' }))

import {
  ALARM_SOUNDS,
  DEFAULT_ALARM_SOUND_KEY,
  SILENT_ALARM_KEY,
  getAlarmSoundUrl,
  isSilentAlarm
} from '../sounds'

describe('ALARM_SOUNDS', () => {
  it('9개 사운드 (8개 + 무음)', () => {
    expect(ALARM_SOUNDS).toHaveLength(9)
  })

  it('SILENT_ALARM_KEY 마지막 항목', () => {
    expect(ALARM_SOUNDS[ALARM_SOUNDS.length - 1].key).toBe(SILENT_ALARM_KEY)
    expect(ALARM_SOUNDS[ALARM_SOUNDS.length - 1].url).toBe('')
  })

  it('DEFAULT_ALARM_SOUND_KEY → 첫 항목의 key', () => {
    expect(DEFAULT_ALARM_SOUND_KEY).toBe(ALARM_SOUNDS[0].key)
  })
})

describe('getAlarmSoundUrl', () => {
  it('매칭 키 → 해당 URL', () => {
    expect(getAlarmSoundUrl('cluck')).toBe('s2.mp3')
  })

  it('SILENT_ALARM_KEY → 빈 문자열', () => {
    expect(getAlarmSoundUrl(SILENT_ALARM_KEY)).toBe('')
  })

  it('매칭 안 됨 → 첫 항목 URL (fallback)', () => {
    expect(getAlarmSoundUrl('non-existent')).toBe(ALARM_SOUNDS[0].url)
  })
})

describe('isSilentAlarm', () => {
  it('SILENT_ALARM_KEY → true', () => {
    expect(isSilentAlarm(SILENT_ALARM_KEY)).toBe(true)
  })

  it('다른 키 → false', () => {
    expect(isSilentAlarm('cluck')).toBe(false)
    expect(isSilentAlarm('')).toBe(false)
  })
})

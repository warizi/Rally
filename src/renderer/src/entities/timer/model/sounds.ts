// Vite ?url import: 빌드 시 mp3 파일을 asset 으로 emit 하고 URL 반환.
// shared/sound/ 의 8개 파일은 한국어 이름이라 import 명을 short id 로 alias.
import s1 from '@/shared/sound/생명유지장치알림소리-삐-삐-삐.mp3?url'
import s2 from '@/shared/sound/알림소리-꼬꼬덱-꼭.mp3?url'
import s3 from '@/shared/sound/알림소리-방사능.mp3?url'
import s4 from '@/shared/sound/알림소리-삐비-.mp3?url'
import s5 from '@/shared/sound/알림소리-삐삐-삐삐.mp3?url'
import s6 from '@/shared/sound/알림소리-삐삐삐삐.mp3?url'
import s7 from '@/shared/sound/알림소리-자명종.mp3?url'
import s8 from '@/shared/sound/탁상시계알림소리-삐삐삐삐.mp3?url'

export interface AlarmSound {
  key: string
  label: string
  url: string
}

export const ALARM_SOUNDS: readonly AlarmSound[] = [
  { key: 'beep-life-support', label: '생명유지장치 (삐-삐-삐)', url: s1 },
  { key: 'cluck', label: '꼬꼬덱-꼭', url: s2 },
  { key: 'radiation', label: '방사능', url: s3 },
  { key: 'beep-short', label: '삐비-', url: s4 },
  { key: 'beep-double', label: '삐삐-삐삐', url: s5 },
  { key: 'beep-quad', label: '삐삐삐삐', url: s6 },
  { key: 'alarm-clock', label: '자명종', url: s7 },
  { key: 'desk-clock', label: '탁상시계 (삐삐삐삐)', url: s8 }
] as const

export const DEFAULT_ALARM_SOUND_KEY = ALARM_SOUNDS[0].key

export function getAlarmSoundUrl(key: string): string {
  const found = ALARM_SOUNDS.find((s) => s.key === key)
  return found?.url ?? ALARM_SOUNDS[0].url
}

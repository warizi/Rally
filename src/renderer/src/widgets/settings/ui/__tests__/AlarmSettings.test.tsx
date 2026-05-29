/**
 * widgets/settings/ui/AlarmSettings.test.tsx
 *
 * alarmSoundKey Select + 미리듣기 / alarmRepeat Switch / ToastSettings.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'

const mocks = vi.hoisted(() => ({
  alarmSoundKey: 'bell',
  setAlarmSoundKey: vi.fn(),
  alarmRepeat: false,
  setAlarmRepeat: vi.fn(),
  isSilent: false,
  soundUrl: '/sounds/bell.mp3' as string | null,
  toastDuration: 4000 as number,
  toastVisibleCount: 3,
  setDuration: vi.fn().mockResolvedValue(undefined),
  setVisibleCount: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@features/timer/manage-alarm', () => ({
  useAlarmSettingsStore: (
    sel: (s: {
      alarmSoundKey: string
      setAlarmSoundKey: typeof mocks.setAlarmSoundKey
      alarmRepeat: boolean
      setAlarmRepeat: typeof mocks.setAlarmRepeat
    }) => unknown
  ) =>
    sel({
      alarmSoundKey: mocks.alarmSoundKey,
      setAlarmSoundKey: mocks.setAlarmSoundKey,
      alarmRepeat: mocks.alarmRepeat,
      setAlarmRepeat: mocks.setAlarmRepeat
    })
}))
vi.mock('@/entities/timer', () => ({
  ALARM_SOUNDS: [
    { key: 'silent', label: '무음' },
    { key: 'bell', label: '벨' }
  ],
  getAlarmSoundUrl: () => mocks.soundUrl,
  isSilentAlarm: () => mocks.isSilent
}))
vi.mock('@/shared/hooks/use-toast-settings', () => ({
  useToastSettings: () => ({
    duration: mocks.toastDuration,
    visibleCount: mocks.toastVisibleCount,
    setDuration: mocks.setDuration,
    setVisibleCount: mocks.setVisibleCount
  }),
  TOAST_DURATION_OPTIONS: [
    { value: 3000, label: '3초' },
    { value: Number.POSITIVE_INFINITY, label: '자동 닫힘 안 함' }
  ],
  TOAST_VISIBLE_COUNT_OPTIONS: [
    { value: 3, label: '3개' },
    { value: 5, label: '5개' }
  ]
}))

interface MockAudio {
  src: string
  volume: number
  currentTime: number
  play: () => Promise<void>
  pause: () => void
}
let audioInstances: MockAudio[] = []

import { AlarmSettings } from '../AlarmSettings'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  mocks.alarmSoundKey = 'bell'
  mocks.alarmRepeat = false
  mocks.isSilent = false
  mocks.soundUrl = '/sounds/bell.mp3'
  mocks.toastDuration = 4000
  mocks.toastVisibleCount = 3
  mocks.setAlarmSoundKey.mockClear()
  mocks.setAlarmRepeat.mockClear()
  mocks.setDuration.mockClear().mockResolvedValue(undefined)
  mocks.setVisibleCount.mockClear().mockResolvedValue(undefined)

  audioInstances = []
  class FakeAudio implements MockAudio {
    src: string
    volume = 0
    currentTime = 0
    play = vi.fn().mockResolvedValue(undefined)
    pause = vi.fn()
    constructor(src: string) {
      this.src = src
      audioInstances.push(this)
    }
  }
  global.Audio = FakeAudio as unknown as typeof Audio
})

describe('AlarmSettings', () => {
  it('타이틀 + alarmSoundKey Select 노출', () => {
    r(<AlarmSettings />)
    expect(screen.getByText('타이머 알림')).toBeInTheDocument()
    expect(screen.getByText('알림 사운드')).toBeInTheDocument()
  })

  it('미리듣기 클릭 → Audio 생성 + play 호출', () => {
    r(<AlarmSettings />)
    fireEvent.click(screen.getByRole('button', { name: /미리듣기/ }))
    expect(audioInstances).toHaveLength(1)
    expect(audioInstances[0].play).toHaveBeenCalled()
  })

  it('isSilent=true → 미리듣기 disabled, Audio 생성 안 함', () => {
    mocks.isSilent = true
    r(<AlarmSettings />)
    const btn = screen.getByRole('button', { name: /미리듣기/ })
    expect(btn).toBeDisabled()
  })

  it('alarmRepeat Switch 클릭 → setAlarmRepeat 호출', () => {
    r(<AlarmSettings />)
    // Switch 의 첫 번째 (alarmRepeat)
    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[0])
    expect(mocks.setAlarmRepeat).toHaveBeenCalledWith(true)
  })

  it('ToastSettings 섹션 노출 (자동 닫힘 시간 + 동시 표시 개수)', () => {
    r(<AlarmSettings />)
    expect(screen.getByText('알림 토스트')).toBeInTheDocument()
    expect(screen.getByText('자동 닫힘 시간')).toBeInTheDocument()
    expect(screen.getByText('동시 표시 개수')).toBeInTheDocument()
  })
})

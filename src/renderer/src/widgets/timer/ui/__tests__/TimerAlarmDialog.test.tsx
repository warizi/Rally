/**
 * widgets/timer/ui/TimerAlarmDialog.test.tsx
 *
 * alarmActive=true → Dialog 노출 + Audio.play 호출. dismiss → cleanup.
 * 무음 사운드 (url=null) → Audio 생성 안 함.
 * alarmRepeat=true → onended 콜백 등록.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  alarmActive: false,
  alarmSoundKey: 'bell',
  alarmRepeat: false,
  dismissAlarm: vi.fn(),
  soundUrl: '/sounds/bell.mp3' as string | null
}))

vi.mock('@/entities/timer', () => ({
  useTimerStore: (sel: (s: { alarmActive: boolean; dismissAlarm: () => void }) => unknown) =>
    sel({ alarmActive: mocks.alarmActive, dismissAlarm: mocks.dismissAlarm }),
  getAlarmSoundUrl: () => mocks.soundUrl
}))
vi.mock('@features/timer/manage-alarm', () => ({
  useAlarmSettingsStore: (sel: (s: { alarmSoundKey: string; alarmRepeat: boolean }) => unknown) =>
    sel({ alarmSoundKey: mocks.alarmSoundKey, alarmRepeat: mocks.alarmRepeat }),
  ALARM_REPEAT_INTERVAL_MS: 2000
}))

import { TimerAlarmDialog } from '../TimerAlarmDialog'

interface MockAudio {
  src: string
  volume: number
  currentTime: number
  onended: (() => void) | null
  play: () => Promise<void>
  pause: () => void
}

let audioInstances: MockAudio[] = []

beforeEach(() => {
  mocks.alarmActive = false
  mocks.alarmSoundKey = 'bell'
  mocks.alarmRepeat = false
  mocks.soundUrl = '/sounds/bell.mp3'
  mocks.dismissAlarm.mockClear()
  audioInstances = []

  // Audio constructor mock (class, not function)
  class FakeAudio implements MockAudio {
    src: string
    volume = 0
    currentTime = 0
    onended: (() => void) | null = null
    play = vi.fn().mockResolvedValue(undefined)
    pause = vi.fn()
    constructor(src: string) {
      this.src = src
      audioInstances.push(this)
    }
  }
  global.Audio = FakeAudio as unknown as typeof Audio
})

describe('TimerAlarmDialog', () => {
  it('alarmActive=false → Dialog 미노출 + Audio 미생성', () => {
    render(<TimerAlarmDialog />)
    expect(screen.queryByText('타이머 종료')).not.toBeInTheDocument()
    expect(audioInstances).toHaveLength(0)
  })

  it('alarmActive=true → Dialog 노출 + Audio.play 호출', () => {
    mocks.alarmActive = true
    render(<TimerAlarmDialog />)
    expect(screen.getByText('타이머 종료')).toBeInTheDocument()
    expect(audioInstances).toHaveLength(1)
    expect(audioInstances[0].play).toHaveBeenCalled()
  })

  it('확인 버튼 클릭 → dismissAlarm 호출', () => {
    mocks.alarmActive = true
    render(<TimerAlarmDialog />)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(mocks.dismissAlarm).toHaveBeenCalled()
  })

  it('alarmRepeat=true → onended 콜백 등록 (반복 재생용)', () => {
    mocks.alarmActive = true
    mocks.alarmRepeat = true
    render(<TimerAlarmDialog />)
    expect(audioInstances[0].onended).toBeInstanceOf(Function)
  })

  it('alarmRepeat=false → onended 등록 안 함', () => {
    mocks.alarmActive = true
    mocks.alarmRepeat = false
    render(<TimerAlarmDialog />)
    expect(audioInstances[0].onended).toBeNull()
  })

  it('soundUrl=null (무음) → Audio 생성 안 함', () => {
    mocks.alarmActive = true
    mocks.soundUrl = null
    render(<TimerAlarmDialog />)
    expect(audioInstances).toHaveLength(0)
    // 다이얼로그는 표시
    expect(screen.getByText('타이머 종료')).toBeInTheDocument()
  })
})

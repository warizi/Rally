/**
 * entities/reminder/ui/ReminderSelect.test.tsx
 *
 * Bell 트리거 노출 + activeCount 표시. Popover 내부 (Radix) 는 portal 렌더 — 트리거만 검증.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  reminders: [] as Array<{ id: string; offsetMs: number; isFired: boolean }>,
  setMutate: vi.fn(),
  removeMutate: vi.fn()
}))

// 컴포넌트가 같은 slice 내부 상대 경로로 import 하므로 barrel 대신 해당 모듈을 mock.
vi.mock('../../api/queries', () => ({
  useReminders: () => ({ data: mocks.reminders }),
  useSetReminder: () => ({ mutate: mocks.setMutate }),
  useRemoveReminder: () => ({ mutate: mocks.removeMutate })
}))

vi.mock('../../model/types', () => ({
  REMINDER_OFFSETS: [
    { value: 600000, label: '10분 전' },
    { value: 1800000, label: '30분 전' }
  ]
}))

import { ReminderSelect } from '../ReminderSelect'

beforeEach(() => {
  mocks.reminders = []
  mocks.setMutate.mockClear()
  mocks.removeMutate.mockClear()
})

describe('ReminderSelect', () => {
  it('reminder 0 개 → "알림" 라벨', () => {
    render(<ReminderSelect entityType="todo" entityId="t-1" />)
    expect(screen.getByRole('button', { name: /알림/ })).toBeInTheDocument()
  })

  it('활성 reminder N 개 → "N개" 라벨', () => {
    mocks.reminders = [
      { id: 'r1', offsetMs: 600000, isFired: false },
      { id: 'r2', offsetMs: 1800000, isFired: false }
    ]
    render(<ReminderSelect entityType="todo" entityId="t-1" />)
    expect(screen.getByRole('button', { name: /2개/ })).toBeInTheDocument()
  })

  it('isFired 된 reminder 는 activeCount 에서 제외', () => {
    mocks.reminders = [
      { id: 'r1', offsetMs: 600000, isFired: false },
      { id: 'r2', offsetMs: 1800000, isFired: true }
    ]
    render(<ReminderSelect entityType="todo" entityId="t-1" />)
    expect(screen.getByRole('button', { name: /1개/ })).toBeInTheDocument()
  })

  it('disabled prop → 버튼 disabled', () => {
    render(<ReminderSelect entityType="schedule" entityId="s-1" disabled />)
    expect(screen.getByRole('button', { name: /알림/ })).toBeDisabled()
  })
})

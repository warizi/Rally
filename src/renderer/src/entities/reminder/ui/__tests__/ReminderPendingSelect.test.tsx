/**
 * entities/reminder/ui/ReminderPendingSelect.test.tsx
 *
 * selected 카운트 라벨 + disabled + popover trigger.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@entities/reminder', () => ({
  REMINDER_OFFSETS: [
    { value: 600000, label: '10분 전' },
    { value: 1800000, label: '30분 전' }
  ]
}))

import { ReminderPendingSelect } from '../ReminderPendingSelect'

describe('ReminderPendingSelect', () => {
  it('selected 0 → "알림" 라벨', () => {
    render(<ReminderPendingSelect selected={[]} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /알림/ })).toBeInTheDocument()
  })

  it('selected N개 → "N개" 라벨', () => {
    render(<ReminderPendingSelect selected={[600000, 1800000]} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /2개/ })).toBeInTheDocument()
  })

  it('disabled → 버튼 disabled', () => {
    render(<ReminderPendingSelect selected={[]} onChange={vi.fn()} disabled />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

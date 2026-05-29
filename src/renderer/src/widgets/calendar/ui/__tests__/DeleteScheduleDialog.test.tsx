/**
 * widgets/calendar/ui/DeleteScheduleDialog.test.tsx
 *
 * useRemoveSchedule mutate + onDeleted forwarding.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useRemoveSchedule } from '@entities/schedule'
import { DeleteScheduleDialog } from '../DeleteScheduleDialog'

vi.mock('@entities/schedule', () => ({
  useRemoveSchedule: vi.fn()
}))

const mutate = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRemoveSchedule).mockReturnValue({ mutate } as unknown as ReturnType<
    typeof useRemoveSchedule
  >)
})

const base = {
  scheduleId: 'sch-1',
  workspaceId: 'ws-1',
  open: true,
  onOpenChange: vi.fn()
}

describe('DeleteScheduleDialog', () => {
  it('open=true → "일정 삭제" 타이틀 노출', () => {
    render(<DeleteScheduleDialog {...base} />)
    expect(screen.getByText('일정 삭제')).toBeInTheDocument()
  })

  it('삭제 클릭 → removeSchedule mutate', () => {
    render(<DeleteScheduleDialog {...base} />)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(mutate).toHaveBeenCalledWith(
      { scheduleId: 'sch-1', workspaceId: 'ws-1' },
      expect.any(Object)
    )
  })

  it('onDeleted forwarding', () => {
    const onDeleted = vi.fn()
    mutate.mockImplementation((_args, opts: { onSuccess: () => void }) => opts.onSuccess())
    render(<DeleteScheduleDialog {...base} onDeleted={onDeleted} />)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(onDeleted).toHaveBeenCalled()
  })

  it('trigger 노드 → AlertDialogTrigger 로 wrap', () => {
    render(
      <DeleteScheduleDialog
        {...base}
        open={undefined as unknown as boolean}
        trigger={<button>open it</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'open it' })).toBeInTheDocument()
  })
})

/**
 * features/csv/edit-csv/ui/EditableCell.test.tsx
 *
 * isEditing 분기 + commit / Tab 이동 / Escape rollback / Shift+Enter 줄바꿈.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditableCell } from '../EditableCell'

describe('EditableCell — 비편집 모드', () => {
  it('value 노출 + cursor-text', () => {
    render(<EditableCell value="hi" onChange={vi.fn()} isEditing={false} onStopEdit={vi.fn()} />)
    expect(screen.getByText('hi')).toBeInTheDocument()
  })

  it('빈 값 → non-breaking space (\\u00A0) 노출 (height 유지)', () => {
    const { container } = render(
      <EditableCell value="" onChange={vi.fn()} isEditing={false} onStopEdit={vi.fn()} />
    )
    expect(container.textContent).toBe(' ')
  })
})

describe('EditableCell — 편집 모드', () => {
  it('input 노출 + 초기 value 표시', () => {
    render(<EditableCell value="hello" onChange={vi.fn()} isEditing={true} onStopEdit={vi.fn()} />)
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument()
  })

  it('input 변경 → onChange 즉시 호출 안 함 (draft 만 갱신)', () => {
    const fn = vi.fn()
    render(<EditableCell value="" onChange={fn} isEditing={true} onStopEdit={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new' } })
    expect(fn).not.toHaveBeenCalled()
  })

  it('blur → commit (onStopEdit + onChange)', () => {
    const onChange = vi.fn()
    const onStop = vi.fn()
    render(<EditableCell value="old" onChange={onChange} isEditing={true} onStopEdit={onStop} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'new' } })
    fireEvent.blur(input)
    expect(onStop).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith('new')
  })

  it('blur + draft 동일 → onChange 호출 안 함', () => {
    const onChange = vi.fn()
    render(<EditableCell value="same" onChange={onChange} isEditing={true} onStopEdit={vi.fn()} />)
    fireEvent.blur(screen.getByRole('textbox'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Enter → commit', () => {
    const onChange = vi.fn()
    const onStop = vi.fn()
    render(<EditableCell value="" onChange={onChange} isEditing={true} onStopEdit={onStop} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'val' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onStop).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith('val')
  })

  it('Escape → draft rollback (onChange 안 호출)', () => {
    const onChange = vi.fn()
    const onStop = vi.fn()
    render(
      <EditableCell value="original" onChange={onChange} isEditing={true} onStopEdit={onStop} />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onStop).toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Tab → commit + onCommitAndMove(0, 1)', () => {
    const onMove = vi.fn()
    render(
      <EditableCell
        value="x"
        onChange={vi.fn()}
        isEditing={true}
        onStopEdit={vi.fn()}
        onCommitAndMove={onMove}
      />
    )
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Tab' })
    expect(onMove).toHaveBeenCalledWith(0, 1)
  })

  it('Shift+Tab → commit + onCommitAndMove(0, -1)', () => {
    const onMove = vi.fn()
    render(
      <EditableCell
        value="x"
        onChange={vi.fn()}
        isEditing={true}
        onStopEdit={vi.fn()}
        onCommitAndMove={onMove}
      />
    )
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Tab', shiftKey: true })
    expect(onMove).toHaveBeenCalledWith(0, -1)
  })

  it('Shift+Enter → 줄바꿈 (커밋 없이 draft 갱신)', () => {
    const onChange = vi.fn()
    const onStop = vi.fn()
    render(<EditableCell value="line1" onChange={onChange} isEditing={true} onStopEdit={onStop} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    input.selectionStart = 5
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(onStop).not.toHaveBeenCalled()
  })
})

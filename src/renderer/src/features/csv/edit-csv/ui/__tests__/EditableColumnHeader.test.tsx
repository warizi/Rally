/**
 * features/csv/edit-csv/ui/EditableColumnHeader.test.tsx
 *
 * editing off → 이름 노출. 더블클릭 → onStartEdit. Trash 버튼 → onRemove.
 * editing on → input. Enter → commit + onRename. Escape → revert.
 * Tab / Shift+Enter → onCommitAndMove.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditableColumnHeader } from '../EditableColumnHeader'

describe('EditableColumnHeader', () => {
  it('uncontrolled — 이름 노출 + 더블클릭 → 편집 모드 input', () => {
    render(<EditableColumnHeader name="col1" colIndex={0} onRename={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.getByText('col1')).toBeInTheDocument()
    fireEvent.doubleClick(screen.getByText('col1'))
    expect(screen.getByRole('textbox')).toHaveValue('col1')
  })

  it('Trash 버튼 클릭 → onRemove(colIndex)', () => {
    const onRemove = vi.fn()
    render(<EditableColumnHeader name="col1" colIndex={3} onRename={vi.fn()} onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onRemove).toHaveBeenCalledWith(3)
  })

  it('controlled — isEditing=true → input 표시', () => {
    render(
      <EditableColumnHeader
        name="x"
        colIndex={0}
        onRename={vi.fn()}
        onRemove={vi.fn()}
        isEditing={true}
      />
    )
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('controlled — startEditing → onStartEdit 호출', () => {
    const onStartEdit = vi.fn()
    render(
      <EditableColumnHeader
        name="x"
        colIndex={0}
        onRename={vi.fn()}
        onRemove={vi.fn()}
        isEditing={false}
        onStartEdit={onStartEdit}
      />
    )
    fireEvent.doubleClick(screen.getByText('x'))
    expect(onStartEdit).toHaveBeenCalled()
  })

  it('Enter → commit + onRename(colIndex, draft) + onStopEdit', () => {
    const onRename = vi.fn()
    const onStopEdit = vi.fn()
    render(
      <EditableColumnHeader
        name="old"
        colIndex={2}
        onRename={onRename}
        onRemove={vi.fn()}
        isEditing={true}
        onStopEdit={onStopEdit}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'new' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledWith(2, 'new')
    expect(onStopEdit).toHaveBeenCalled()
  })

  it('Escape → revert, onRename 호출 안 함', () => {
    const onRename = vi.fn()
    render(
      <EditableColumnHeader
        name="old"
        colIndex={0}
        onRename={onRename}
        onRemove={vi.fn()}
        isEditing={true}
        onStopEdit={vi.fn()}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'new' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onRename).not.toHaveBeenCalled()
  })

  it('Tab → commit + onCommitAndMove(0, +1)', () => {
    const onCommitAndMove = vi.fn()
    render(
      <EditableColumnHeader
        name="x"
        colIndex={0}
        onRename={vi.fn()}
        onRemove={vi.fn()}
        isEditing={true}
        onStopEdit={vi.fn()}
        onCommitAndMove={onCommitAndMove}
      />
    )
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Tab' })
    expect(onCommitAndMove).toHaveBeenCalledWith(0, 1)
  })

  it('Shift+Tab → onCommitAndMove(0, -1)', () => {
    const onCommitAndMove = vi.fn()
    render(
      <EditableColumnHeader
        name="x"
        colIndex={0}
        onRename={vi.fn()}
        onRemove={vi.fn()}
        isEditing={true}
        onStopEdit={vi.fn()}
        onCommitAndMove={onCommitAndMove}
      />
    )
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Tab', shiftKey: true })
    expect(onCommitAndMove).toHaveBeenCalledWith(0, -1)
  })

  it('Shift+Enter → onCommitAndMove(1, 0)', () => {
    const onCommitAndMove = vi.fn()
    render(
      <EditableColumnHeader
        name="x"
        colIndex={0}
        onRename={vi.fn()}
        onRemove={vi.fn()}
        isEditing={true}
        onStopEdit={vi.fn()}
        onCommitAndMove={onCommitAndMove}
      />
    )
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: true })
    expect(onCommitAndMove).toHaveBeenCalledWith(1, 0)
  })

  it('이름 변경 안 함 → onRename 호출 안 함', () => {
    const onRename = vi.fn()
    render(
      <EditableColumnHeader
        name="same"
        colIndex={0}
        onRename={onRename}
        onRemove={vi.fn()}
        isEditing={true}
        onStopEdit={vi.fn()}
      />
    )
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onRename).not.toHaveBeenCalled()
  })
})

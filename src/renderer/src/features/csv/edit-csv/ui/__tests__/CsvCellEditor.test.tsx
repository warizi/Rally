/**
 * features/csv/edit-csv/ui/CsvCellEditor.test.tsx
 *
 * floating 셀 에디터: type-to-edit 진입, 편집 중 Tab/Enter/방향키 커밋+이동, Escape revert, seed 교체.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CsvCellEditor } from '../CsvCellEditor'

const base = {
  top: 0,
  left: 0,
  width: 100,
  height: 28,
  cellKey: '0_0',
  onChange: vi.fn(),
  onStartEditing: vi.fn(),
  onStopEdit: vi.fn(),
  onCommitAndMove: vi.fn()
}

describe('CsvCellEditor — 비편집(active)', () => {
  it('비편집 시 input 은 비어 있음 (값은 셀 div 가 표시 → 타이핑 시 조합 안전)', () => {
    render(<CsvCellEditor {...base} value="hello" isEditing={false} />)
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('타이핑(change) → onStartEditing 호출 (편집 시작)', () => {
    const onStartEditing = vi.fn()
    render(<CsvCellEditor {...base} value="x" isEditing={false} onStartEditing={onStartEditing} />)
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } })
    expect(onStartEditing).toHaveBeenCalled()
  })

  it('compositionstart → input 불투명(bg-background) (기존 값과 겹침 방지)', () => {
    render(<CsvCellEditor {...base} value="old" isEditing={false} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.classList.contains('bg-transparent')).toBe(true)
    fireEvent.compositionStart(input)
    expect(input.classList.contains('bg-background')).toBe(true)
    expect(input.classList.contains('bg-transparent')).toBe(false)
  })

  it('compositionend → onStartEditing 호출 (첫 음절 조합 완료 후 편집 전환)', () => {
    const onStartEditing = vi.fn()
    render(<CsvCellEditor {...base} value="x" isEditing={false} onStartEditing={onStartEditing} />)
    const input = screen.getByRole('textbox')
    // 조합 중(compositionstart/update)에는 전환 안 함
    fireEvent.compositionStart(input)
    expect(onStartEditing).not.toHaveBeenCalled()
    // 조합 완료 시 전환
    fireEvent.compositionEnd(input)
    expect(onStartEditing).toHaveBeenCalled()
  })

  it('비편집 IME/printable keydown → stopPropagation (grid type-to-edit 가 첫 자모 가로채는 것 방지)', () => {
    const parentKeyDown = vi.fn()
    render(
      <div onKeyDown={parentKeyDown}>
        <CsvCellEditor {...base} value="x" isEditing={false} />
      </div>
    )
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Process', keyCode: 229 }) // IME 시작
    fireEvent.keyDown(input, { key: 'a' }) // printable
    expect(parentKeyDown).not.toHaveBeenCalled()
  })

  it('비편집 Arrow keydown → grid 로 bubble (네비게이션 위임)', () => {
    const parentKeyDown = vi.fn()
    render(
      <div onKeyDown={parentKeyDown}>
        <CsvCellEditor {...base} value="x" isEditing={false} />
      </div>
    )
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowDown' })
    expect(parentKeyDown).toHaveBeenCalled()
  })

  it('type-to-edit: 빈 input 에 입력 → commit 시 기존값 교체', () => {
    const onChange = vi.fn()
    const onStartEditing = vi.fn()
    const { rerender } = render(
      <CsvCellEditor
        {...base}
        value="old"
        isEditing={false}
        onChange={onChange}
        onStartEditing={onStartEditing}
      />
    )
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('') // idle 은 비어 있음
    fireEvent.input(input, { target: { value: 'new' } })
    expect(onStartEditing).toHaveBeenCalled()
    // 편집 모드로 전환되어 입력값 commit
    rerender(
      <CsvCellEditor
        {...base}
        value="old"
        isEditing={true}
        onChange={onChange}
        onStartEditing={onStartEditing}
      />
    )
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith('new')
  })
})

describe('CsvCellEditor — 편집 중', () => {
  it('seed(initialValue) 주어지면 draft 교체', () => {
    render(<CsvCellEditor {...base} value="abc" isEditing={true} initialValue="z" />)
    expect(screen.getByRole('textbox')).toHaveValue('z')
  })

  it('seed 없으면 기존값 유지', () => {
    render(<CsvCellEditor {...base} value="abc" isEditing={true} />)
    expect(screen.getByRole('textbox')).toHaveValue('abc')
  })

  it('Enter → commit + onCommitAndMove(1,0)', () => {
    const onChange = vi.fn()
    const onStop = vi.fn()
    const onMove = vi.fn()
    render(
      <CsvCellEditor
        {...base}
        value=""
        isEditing={true}
        onChange={onChange}
        onStopEdit={onStop}
        onCommitAndMove={onMove}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'val' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onStop).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith('val')
    expect(onMove).toHaveBeenCalledWith(1, 0, 'enter')
  })

  it('Tab → onCommitAndMove(0,1,tab), Shift+Tab → (0,-1,tab)', () => {
    const onMove = vi.fn()
    render(<CsvCellEditor {...base} value="x" isEditing={true} onCommitAndMove={onMove} />)
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(onMove).toHaveBeenCalledWith(0, 1, 'tab')
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })
    expect(onMove).toHaveBeenCalledWith(0, -1, 'tab')
  })

  it('방향키 → 커밋 후 해당 방향 이동 (부호 그대로, source=arrow)', () => {
    const onMove = vi.fn()
    render(<CsvCellEditor {...base} value="x" isEditing={true} onCommitAndMove={onMove} />)
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(onMove).toHaveBeenCalledWith(1, 0, 'arrow')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onMove).toHaveBeenCalledWith(-1, 0, 'arrow')
    fireEvent.keyDown(input, { key: 'ArrowLeft' })
    expect(onMove).toHaveBeenCalledWith(0, -1, 'arrow')
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(onMove).toHaveBeenCalledWith(0, 1, 'arrow')
  })

  it('Escape → revert (onStopEdit, onChange 호출 안 함)', () => {
    const onChange = vi.fn()
    const onStop = vi.fn()
    render(
      <CsvCellEditor
        {...base}
        value="orig"
        isEditing={true}
        onChange={onChange}
        onStopEdit={onStop}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onStop).toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('blur → commit', () => {
    const onChange = vi.fn()
    const onStop = vi.fn()
    render(
      <CsvCellEditor
        {...base}
        value="old"
        isEditing={true}
        onChange={onChange}
        onStopEdit={onStop}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'new' } })
    fireEvent.blur(input)
    expect(onStop).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith('new')
  })

  it('IME 조합 중 Enter → commit 안 함 (조합 확정용)', () => {
    const onStop = vi.fn()
    render(<CsvCellEditor {...base} value="x" isEditing={true} onStopEdit={onStop} />)
    const input = screen.getByRole('textbox')
    fireEvent.compositionStart(input) // composingRef = true
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onStop).not.toHaveBeenCalled()
  })
})

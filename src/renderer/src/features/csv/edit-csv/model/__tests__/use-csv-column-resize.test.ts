import { renderHook } from '@testing-library/react'
import { MIN_COL_WIDTH } from '../types'
import { useCsvColumnResize } from '../use-csv-column-resize'

let getColWidth: ReturnType<typeof vi.fn>
let onColumnSizingChange: ReturnType<typeof vi.fn>
let addEventSpy: ReturnType<typeof vi.spyOn>
let removeEventSpy: ReturnType<typeof vi.spyOn>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(initialWidth = 150) {
  getColWidth = vi.fn().mockReturnValue(initialWidth)
  onColumnSizingChange = vi.fn()
  addEventSpy = vi.spyOn(document, 'addEventListener')
  removeEventSpy = vi.spyOn(document, 'removeEventListener')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderHook(() => useCsvColumnResize(getColWidth as any, onColumnSizingChange as any))
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createMouseEvent(clientX = 100) {
  return {
    clientX,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  } as unknown as React.MouseEvent
}

function getListener(
  spy: ReturnType<typeof vi.spyOn>,
  eventName: string
): EventListener | undefined {
  const call = spy.mock.calls.find(([name]) => name === eventName)
  return call ? (call[1] as EventListener) : undefined
}

beforeEach(() => {
  vi.restoreAllMocks()
})

// ─── handleResizeStart ───────────────────────────────────

describe('handleResizeStart', () => {
  it('1 — e.preventDefault + e.stopPropagation 호출', () => {
    const { result } = setup()
    const e = createMouseEvent()
    result.current.handleResizeStart(0, e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(e.stopPropagation).toHaveBeenCalled()
  })

  it('2 — document.addEventListener("mousemove") 등록', () => {
    const { result } = setup()
    result.current.handleResizeStart(0, createMouseEvent())
    expect(addEventSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
  })

  it('3 — document.addEventListener("mouseup") 등록', () => {
    const { result } = setup()
    result.current.handleResizeStart(0, createMouseEvent())
    expect(addEventSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
  })
})

// ─── 드래그 중 (mousemove) ───────────────────────────────

describe('드래그 중 (mousemove)', () => {
  it('4 — 오른쪽 드래그 → 너비 증가', () => {
    const startWidth = 150
    const { result } = setup(startWidth)
    const startX = 100
    result.current.handleResizeStart(0, createMouseEvent(startX))

    const onMouseMove = getListener(addEventSpy, 'mousemove')!
    onMouseMove(new MouseEvent('mousemove', { clientX: startX + 50 }))

    expect(onColumnSizingChange).toHaveBeenCalled()
    const updater = onColumnSizingChange.mock.calls[0][0]
    const newState = updater({})
    expect(newState).toEqual({ col_0: startWidth + 50 })
  })

  it('5 — 왼쪽 드래그 → MIN_COL_WIDTH 이하로 축소 불가', () => {
    const startWidth = 80
    const { result } = setup(startWidth)
    const startX = 100
    result.current.handleResizeStart(0, createMouseEvent(startX))

    const onMouseMove = getListener(addEventSpy, 'mousemove')!
    onMouseMove(new MouseEvent('mousemove', { clientX: startX - 200 }))

    const updater = onColumnSizingChange.mock.calls[0][0]
    const newState = updater({})
    expect(newState.col_0).toBe(MIN_COL_WIDTH)
  })

  it('6 — onColumnSizingChange에 updater 함수 전달 (기존 상태 보존)', () => {
    const { result } = setup(150)
    result.current.handleResizeStart(1, createMouseEvent(100))

    const onMouseMove = getListener(addEventSpy, 'mousemove')!
    onMouseMove(new MouseEvent('mousemove', { clientX: 120 }))

    const updater = onColumnSizingChange.mock.calls[0][0]
    expect(typeof updater).toBe('function')
    const newState = updater({ col_0: 200 })
    expect(newState).toEqual({ col_0: 200, col_1: 170 })
  })
})

// ─── 드래그 종료 (mouseup) ───────────────────────────────

describe('드래그 종료 (mouseup)', () => {
  it('7 — mousemove + mouseup 리스너 제거', () => {
    const { result } = setup()
    result.current.handleResizeStart(0, createMouseEvent())

    const onMouseUp = getListener(addEventSpy, 'mouseup')!
    onMouseUp(new MouseEvent('mouseup'))

    expect(removeEventSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(removeEventSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
  })

  it('8 — 제거 후 mousemove → onColumnSizingChange 미호출', () => {
    const { result } = setup()
    result.current.handleResizeStart(0, createMouseEvent(100))

    const onMouseUp = getListener(addEventSpy, 'mouseup')!

    // Trigger mouseup to clean up
    onMouseUp(new MouseEvent('mouseup'))
    onColumnSizingChange.mockClear()

    // After cleanup, calling the captured mousemove should not trigger anything
    // because removeEventListener was called — but since we have the direct reference,
    // we verify via the real document behavior
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 }))
    expect(onColumnSizingChange).not.toHaveBeenCalled()
  })
})

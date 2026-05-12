/**
 * @dnd-kit DnD 시뮬레이션 헬퍼.
 * PointerSensor.activationConstraint.distance(기본 8) 통과를 위해 최소 이동량 확보.
 *
 * happy-dom에서 pointer events 실패 시 fallback으로 fireEvent.mouse* 또는
 * DndContext 의 onDragEnd 직접 호출 고려.
 */
import { fireEvent } from '@testing-library/react'

export interface DragOptions {
  activationDistance?: number
}

export function simulateDrag(
  source: HTMLElement,
  target: HTMLElement,
  options: DragOptions = {}
): void {
  const distance = options.activationDistance ?? 10

  fireEvent.pointerDown(source, {
    pointerId: 1,
    button: 0,
    clientX: 0,
    clientY: 0,
    pointerType: 'mouse'
  })

  fireEvent.pointerMove(source, {
    pointerId: 1,
    clientX: distance,
    clientY: distance,
    pointerType: 'mouse'
  })

  const rect = target.getBoundingClientRect()
  fireEvent.pointerMove(target, {
    pointerId: 1,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
    pointerType: 'mouse'
  })

  fireEvent.pointerUp(target, {
    pointerId: 1,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
    pointerType: 'mouse'
  })
}

export function simulateKeyboardDrag(
  source: HTMLElement,
  direction: 'up' | 'down' | 'left' | 'right',
  steps: number
): void {
  source.focus()
  fireEvent.keyDown(source, { key: ' ', code: 'Space' })

  const keyMap = {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight'
  } as const

  for (let i = 0; i < steps; i++) {
    fireEvent.keyDown(source, { key: keyMap[direction], code: keyMap[direction] })
  }

  fireEvent.keyDown(source, { key: ' ', code: 'Space' })
}

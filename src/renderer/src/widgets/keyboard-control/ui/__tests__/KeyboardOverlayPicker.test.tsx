/**
 * widgets/keyboard-control/ui/KeyboardOverlayPicker.test.tsx
 *
 * items 비었음 → "항목 없음". focusIndex → Check 아이콘 및 ring-2 ring-primary 클래스.
 * title / footer / icon / meta 분기.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KeyboardOverlayPicker } from '../KeyboardOverlayPicker'

describe('KeyboardOverlayPicker', () => {
  it('items 비었음 → "항목 없음"', () => {
    render(<KeyboardOverlayPicker items={[]} focusIndex={0} />)
    expect(screen.getByText('항목 없음')).toBeInTheDocument()
  })

  it('items 있음 → 각 label 노출', () => {
    render(
      <KeyboardOverlayPicker
        items={[
          { id: '1', label: 'First' },
          { id: '2', label: 'Second' }
        ]}
        focusIndex={0}
      />
    )
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('focusIndex → 해당 항목에 ring-2 ring-primary 클래스 + Check 아이콘', () => {
    const { container } = render(
      <KeyboardOverlayPicker
        items={[
          { id: '1', label: 'A' },
          { id: '2', label: 'B' }
        ]}
        focusIndex={1}
      />
    )
    const items = container.querySelectorAll('.rounded-md.border')
    expect(items[1].className).toMatch(/ring-2/)
    expect(items[0].className).not.toMatch(/ring-2/)
  })

  it('title 있음 → 노출', () => {
    render(<KeyboardOverlayPicker items={[]} focusIndex={0} title="탭 이동" />)
    expect(screen.getByText('탭 이동')).toBeInTheDocument()
  })

  it('footer 있음 → 노출', () => {
    render(
      <KeyboardOverlayPicker items={[]} focusIndex={0} footer={<span>shift+tab 으로 이동</span>} />
    )
    expect(screen.getByText('shift+tab 으로 이동')).toBeInTheDocument()
  })

  it('item.icon + item.meta → 함께 노출', () => {
    render(
      <KeyboardOverlayPicker
        items={[
          {
            id: '1',
            label: 'WithExtras',
            icon: <span data-testid="icon" />,
            meta: <span>extra-meta</span>
          }
        ]}
        focusIndex={-1}
      />
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('extra-meta')).toBeInTheDocument()
  })

  it('data-testid="keyboard-overlay-picker" 루트', () => {
    render(<KeyboardOverlayPicker items={[]} focusIndex={0} />)
    expect(screen.getByTestId('keyboard-overlay-picker')).toBeInTheDocument()
  })
})

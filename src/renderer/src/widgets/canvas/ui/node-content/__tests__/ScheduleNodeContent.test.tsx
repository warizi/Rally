/**
 * widgets/canvas/ui/node-content/ScheduleNodeContent.test.tsx
 *
 * 일정 노드 컨텐츠 — 시간/위치/설명/색상 dot 분기.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScheduleNodeContent } from '../ScheduleNodeContent'
import type { NodeContentProps } from '../../../model/node-content-registry'

function props(meta: Record<string, unknown> = {}, title = '회의'): NodeContentProps {
  return {
    refTitle: title,
    refPreview: '',
    refMeta: meta,
    refId: 'sch-1',
    canvasId: 'cv-1'
  } as unknown as NodeContentProps
}

describe('ScheduleNodeContent', () => {
  it('refTitle 노출', () => {
    render(<ScheduleNodeContent {...props()} />)
    expect(screen.getByText('회의')).toBeInTheDocument()
  })

  it('refTitle 빈 문자열 → "(제목 없음)"', () => {
    render(<ScheduleNodeContent {...props({}, '')} />)
    expect(screen.getByText('(제목 없음)')).toBeInTheDocument()
  })

  it('color 있으면 dot 렌더', () => {
    const { container } = render(<ScheduleNodeContent {...props({ color: '#ef4444' })} />)
    const dot = container.querySelector('div[style*="background"]')
    expect(dot).toBeInTheDocument()
  })

  it('startAt/endAt allDay 같은 날 → 단일 날짜 표시', () => {
    render(
      <ScheduleNodeContent
        {...props({
          startAt: '2026-05-29T00:00:00Z',
          endAt: '2026-05-29T23:59:59Z',
          allDay: true
        })}
      />
    )
    // "MM.dd (eee)" 형식 — 정확한 텍스트가 timezone 영향 받으므로 substring 검증
    expect(screen.getByText(/05\.29/)).toBeInTheDocument()
  })

  it('startAt/endAt 시간 포함 → "HH:mm ~ HH:mm"', () => {
    render(
      <ScheduleNodeContent
        {...props({
          startAt: new Date('2026-05-29T09:00:00').toISOString(),
          endAt: new Date('2026-05-29T10:30:00').toISOString(),
          allDay: false
        })}
      />
    )
    expect(screen.getByText(/~/)).toBeInTheDocument()
  })

  it('location 있으면 노출', () => {
    render(<ScheduleNodeContent {...props({ location: '회의실 A' })} />)
    expect(screen.getByText('회의실 A')).toBeInTheDocument()
  })

  it('description 있으면 노출', () => {
    render(<ScheduleNodeContent {...props({ description: '안건 정리' })} />)
    expect(screen.getByText('안건 정리')).toBeInTheDocument()
  })

  it('meta 모두 없으면 시간/위치/설명 미렌더', () => {
    const { container } = render(<ScheduleNodeContent {...props({})} />)
    // 시간 관련 svg (Clock) 미렌더
    expect(container.querySelector('svg.lucide-clock')).not.toBeInTheDocument()
  })
})

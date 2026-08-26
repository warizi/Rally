/**
 * M-5 — ErrorBoundary 회귀 차단.
 *
 * 핵심 계약: **하나가 죽어도 형제는 산다.** React 18+ 는 미포착 렌더 예외에서 전체
 * 트리를 언마운트하므로, 경계가 없으면 캔버스 노드 하나가 앱 전체를 백스크린으로 만든다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../error-boundary'

/** 의도적으로 렌더 중 throw 하는 컴포넌트 */
function Boom({ message = '터졌다' }: { message?: string }): React.JSX.Element {
  throw new Error(message)
}

function Fine({ label }: { label: string }): React.JSX.Element {
  return <div>{label}</div>
}

const fallback = (error: Error, reset: () => void): React.JSX.Element => (
  <div>
    <span>오류: {error.message}</span>
    <button onClick={reset}>다시 시도</button>
  </div>
)

// React 는 경계가 잡은 오류도 console.error 로 한 번 뱉는다 — 테스트 출력 오염 방지
let consoleSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  consoleSpy.mockRestore()
})

describe('ErrorBoundary — 기본 동작', () => {
  it('정상일 때는 children 을 그대로 렌더한다', () => {
    render(
      <ErrorBoundary fallback={fallback}>
        <Fine label="정상 컨텐츠" />
      </ErrorBoundary>
    )
    expect(screen.getByText('정상 컨텐츠')).toBeInTheDocument()
  })

  it('렌더 중 throw 하면 fallback 을 보여준다', () => {
    render(
      <ErrorBoundary fallback={fallback}>
        <Boom message="캔버스 노드 실패" />
      </ErrorBoundary>
    )
    expect(screen.getByText('오류: 캔버스 노드 실패')).toBeInTheDocument()
  })

  it('reset 하면 다시 렌더를 시도한다', () => {
    let shouldThrow = true
    function Toggle(): React.JSX.Element {
      if (shouldThrow) throw new Error('일시적 실패')
      return <div>복구됨</div>
    }

    render(
      <ErrorBoundary fallback={fallback}>
        <Toggle />
      </ErrorBoundary>
    )
    expect(screen.getByText('오류: 일시적 실패')).toBeInTheDocument()

    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(screen.getByText('복구됨')).toBeInTheDocument()
  })

  it('resetKey 가 바뀌면 이전 오류를 끌고 가지 않는다', () => {
    const { rerender } = render(
      <ErrorBoundary fallback={fallback} resetKey="tab-1">
        <Boom />
      </ErrorBoundary>
    )
    expect(screen.getByText(/오류:/)).toBeInTheDocument()

    // 같은 자리에 다른 탭이 온 상황
    rerender(
      <ErrorBoundary fallback={fallback} resetKey="tab-2">
        <Fine label="다른 탭" />
      </ErrorBoundary>
    )
    expect(screen.getByText('다른 탭')).toBeInTheDocument()
    expect(screen.queryByText(/오류:/)).not.toBeInTheDocument()
  })
})

describe('ErrorBoundary — 격리 (이 테스트가 이 기능의 존재 이유다)', () => {
  it('형제 중 하나가 죽어도 나머지는 살아남는다', () => {
    render(
      <div>
        <ErrorBoundary fallback={fallback} resetKey="a">
          <Fine label="탭 A" />
        </ErrorBoundary>
        <ErrorBoundary fallback={fallback} resetKey="b">
          <Boom message="탭 B 실패" />
        </ErrorBoundary>
        <ErrorBoundary fallback={fallback} resetKey="c">
          <Fine label="탭 C" />
        </ErrorBoundary>
      </div>
    )

    expect(screen.getByText('탭 A')).toBeInTheDocument()
    expect(screen.getByText('오류: 탭 B 실패')).toBeInTheDocument()
    expect(screen.getByText('탭 C')).toBeInTheDocument()
  })

  it('경계가 없으면 형제까지 함께 사라진다 (경계의 필요성 확인)', () => {
    // 경계 하나로 셋을 감싼 경우 — 하나가 터지면 전부 날아간다.
    render(
      <ErrorBoundary fallback={fallback}>
        <div>
          <Fine label="함께 죽는 A" />
          <Boom message="전체 실패" />
          <Fine label="함께 죽는 C" />
        </div>
      </ErrorBoundary>
    )

    expect(screen.getByText('오류: 전체 실패')).toBeInTheDocument()
    expect(screen.queryByText('함께 죽는 A')).not.toBeInTheDocument()
    expect(screen.queryByText('함께 죽는 C')).not.toBeInTheDocument()
  })
})

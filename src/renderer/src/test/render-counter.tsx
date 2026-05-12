/**
 * Profiler 기반 렌더 횟수 측정 헬퍼.
 * P1-4 TodoListItem 메모이제이션 효과 측정의 핵심.
 *
 * 사용:
 *   const { counter, result } = renderWithCounter(<MyUI />)
 *   counter.reset()
 *   result.rerender(<MyUI updated />)
 *   expect(counter.count).toBeLessThanOrEqual(2)
 *
 * result.rerender 호출 시에도 Profiler 래퍼가 유지되도록 wrapper 옵션 사용.
 */
import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from 'react'
import { render, type RenderResult } from '@testing-library/react'

export interface RenderCounter {
  count: number
  byId: Map<string, number>
  reset: () => void
}

interface RenderWithCounterResult {
  counter: RenderCounter
  result: RenderResult
}

export function renderWithCounter(
  ui: ReactNode,
  options?: { id?: string }
): RenderWithCounterResult {
  const profilerId = options?.id ?? 'test'

  const counter: RenderCounter = {
    count: 0,
    byId: new Map<string, number>(),
    reset() {
      counter.count = 0
      counter.byId.clear()
    }
  }

  const onRender: ProfilerOnRenderCallback = (id) => {
    counter.count++
    counter.byId.set(id, (counter.byId.get(id) ?? 0) + 1)
  }

  function ProfilerWrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <Profiler id={profilerId} onRender={onRender}>
        {children}
      </Profiler>
    )
  }

  // wrapper 옵션을 통해 rerender 시에도 Profiler 가 유지됨
  const result = render(ui, { wrapper: ProfilerWrapper })

  return { counter, result }
}

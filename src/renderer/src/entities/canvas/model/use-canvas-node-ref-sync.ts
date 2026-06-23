import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * 캔버스 노드가 참조하는 다른 도메인(note/csv/pdf/image/todo/schedule)이 변경되면
 * 노드의 참조 스냅샷(`refTitle` 등 — 서버 batchFetchRefs 가 canvasNode fetch 시 재계산)이
 * stale 해진다. 해당 도메인의 onChanged(외부/MCP) 수신 시 `['canvasNode']` 를 무효화해
 * 열린 캔버스의 노드가 참조 항목의 삭제·제목변경을 실시간 반영하도록 한다.
 *
 * (canvas:changed 자체는 useCanvasWatcher 가 처리 — 이 훅은 "참조된 타 도메인" 변경 담당)
 * MainLayout 에서 1회 마운트.
 */
export function useCanvasNodeRefSync(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const invalidate = (): void => {
      queryClient.invalidateQueries({ queryKey: ['canvasNode'] })
    }
    const unsubs = [
      window.api.note.onChanged(invalidate),
      window.api.csv.onChanged(invalidate),
      window.api.pdf.onChanged(invalidate),
      window.api.image.onChanged(invalidate),
      window.api.todo.onChanged(invalidate),
      window.api.schedule.onChanged(invalidate)
    ]
    return () => unsubs.forEach((u) => u())
  }, [queryClient])
}

import { useEffect } from 'react'
import { CSV_EXTERNAL_CHANGED_EVENT } from '@entities/csv-file'

/**
 * CSV 외부 변경 감지 시 콜백 호출
 * own-write-tracker를 통해 자체 저장은 이미 필터링됨
 */
export function useCsvExternalSync(csvId: string, onExternalChange: () => void): void {
  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent).detail
      if (detail?.csvId === csvId) {
        onExternalChange()
      }
    }
    window.addEventListener(CSV_EXTERNAL_CHANGED_EVENT, handler)
    return () => window.removeEventListener(CSV_EXTERNAL_CHANGED_EVENT, handler)
  }, [csvId, onExternalChange])
}

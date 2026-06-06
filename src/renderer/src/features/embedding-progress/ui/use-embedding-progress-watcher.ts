import { createElement, useEffect } from 'react'
import { toast } from 'sonner'
import { ProgressBar } from './ProgressBar'

type ProgressKey = 'download' | 'index'

const LABELS: Record<ProgressKey, string> = {
  download: '검색 모델 다운로드 중',
  index: '기존 데이터 검색 인덱싱 중'
}
const DONE_LABELS: Record<ProgressKey, string> = {
  download: '검색 모델 준비 완료',
  index: '검색 인덱싱 완료'
}

/**
 * 임베딩 진행(모델 다운로드 / 백필 인덱싱)을 sonner 토스트로 표시.
 * - toast.loading: 스피너 아이콘 + sonner 기본 스타일(배경/타이포). description에 진행바.
 * - 완료: toast.success(같은 id) → 체크 아이콘으로 전환 후 자동 닫힘.
 *   (loading→success 동일 id 전환은 toast.promise 와 같은 안전 패턴 → 무한 업데이트 없음)
 * - key별 고정 id로 in-place 갱신. MainLayout 에서 1회 마운트.
 */
export function useEmbeddingProgressWatcher(): void {
  useEffect(() => {
    return window.api.embedding.onProgress(({ key, value, done }) => {
      const id = `embedding-progress-${key}`
      if (done) {
        if (value >= 100) toast.success(DONE_LABELS[key], { id, duration: 2500 })
        else toast.dismiss(id) // 실패/취소 → 조용히 닫기
        return
      }
      toast.loading(LABELS[key], {
        id,
        description: createElement(ProgressBar, { value }),
        duration: Infinity,
        // sonner의 [data-content] 는 flex:1 이 없어 제목 폭에만 맞음 → flex-1 로 토스트 폭을
        // 채워 진행바가 전체 폭으로 늘어나고 우측 여백이 사라짐.
        classNames: { content: 'flex-1' }
      })
    })
  }, [])
}

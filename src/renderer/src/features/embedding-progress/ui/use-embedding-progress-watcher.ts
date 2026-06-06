import { createElement, useEffect } from 'react'
import { toast } from 'sonner'
import { ProgressToast } from './ProgressToast'

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
 * 임베딩 진행(모델 다운로드 / 백필 인덱싱)을 토스트+프로그래스바로 표시.
 * - key별로 고정 id 토스트를 in-place 갱신 → 진행률 반영
 * - 완료 전까지 duration:Infinity 로 유지, 완료 시 성공 토스트로 교체(자동 닫힘)
 * - MainLayout 에서 1회 마운트.
 */
export function useEmbeddingProgressWatcher(): void {
  useEffect(() => {
    return window.api.embedding.onProgress(({ key, value, done }) => {
      const id = `embedding-progress-${key}`
      if (done) {
        // value 100 = 정상 완료, 그 외(0) = 실패/취소 → 조용히 닫기
        if (value >= 100) toast.success(DONE_LABELS[key], { id, duration: 3000 })
        else toast.dismiss(id)
        return
      }
      toast.custom(() => createElement(ProgressToast, { label: LABELS[key], value }), {
        id,
        duration: Infinity
      })
    })
  }, [])
}

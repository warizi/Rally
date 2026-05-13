/**
 * CSS 크기 문자열 ("1.875rem", "16px") ↔ { value, unit } 변환.
 *
 * - 사용자 UI 는 숫자 input + 단위 토글로 노출하지만, 저장 형식은 기존 문자열 유지
 *   (호환성 + buildNoteStyleCss 변경 최소화).
 */
export type SizeUnit = 'rem' | 'px'

export interface SizeValue {
  value: number
  unit: SizeUnit
}

const DEFAULT: SizeValue = { value: 1, unit: 'rem' }

/**
 * "1.875rem" / "16px" / "0" / "" → SizeValue.
 *
 * - 단위 누락 시 rem 으로 간주
 * - 알 수 없는 단위(em/% 등) 는 rem 으로 fallback + 숫자만 유지
 * - 파싱 실패 시 { value: 0, unit: 'rem' } (= "0rem", "0px" 등과 자연스럽게 어울림)
 */
export function parseSize(s: string): SizeValue {
  const trimmed = s.trim()
  if (!trimmed) return { ...DEFAULT, value: 0 }

  const match = trimmed.match(/^(-?[\d.]+)\s*([a-z%]*)$/i)
  if (!match) return { ...DEFAULT, value: 0 }

  const value = parseFloat(match[1])
  if (!Number.isFinite(value)) return { ...DEFAULT, value: 0 }

  const rawUnit = match[2].toLowerCase()
  const unit: SizeUnit = rawUnit === 'px' ? 'px' : 'rem'
  return { value, unit }
}

/**
 * SizeValue → CSS 문자열.
 *
 * - 0 은 단위 무관하게 "0" 으로 정규화하지 않고 단위 유지 (UI 일관성).
 * - 소수점 끝 0 trim (1.20 → "1.2rem")
 */
export function formatSize({ value, unit }: SizeValue): string {
  // 소수점 2자리로 반올림 (예: 0.28125rem → 0.28rem, 1.925rem → 1.93rem)
  const rounded = Math.round(value * 100) / 100
  return `${rounded}${unit}`
}

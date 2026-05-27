/**
 * Date 객체의 시간 부분(HH:mm)을 'HH:mm' 문자열로 추출.
 * - null/undefined → null
 * - 00:00 정각 → null (TimePicker 에서 "시간 미설정"으로 표시하기 위함)
 *   호출 측에서 "사용자가 명시적으로 자정을 선택" 케이스를 구분해야 하면 별도 처리 필요.
 */
export function formatTime(d: Date | null): string | null {
  if (!d) return null
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  if (h === '00' && m === '00') return null
  return `${h}:${m}`
}

/**
 * Date 에 'HH:mm' 시간을 적용해 새 Date 를 반환.
 * - date 가 null 이면 null 반환 (시간만 따로 보관 안 함)
 * - time 이 null/'' 이면 00:00 으로 리셋
 */
export function applyTime(date: Date | null, time: string | null): Date | null {
  if (!date) return null
  const [hh = '0', mm = '0'] = (time ?? '00:00').split(':')
  const next = new Date(date)
  next.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0)
  return next
}

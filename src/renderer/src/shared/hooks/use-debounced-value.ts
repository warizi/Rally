import { useEffect, useState } from 'react'

/**
 * 입력 값을 일정 시간 동안 변화 없을 때만 반영하는 디바운스 훅.
 *
 * 검색창 같이 매 keystroke 마다 무거운 작업 (트리 매칭, IPC 호출) 트리거를
 * 막을 때 사용. 마지막 변경 후 `delay` ms 가 지나면 debounced value 갱신.
 *
 * @example
 *   const [query, setQuery] = useState('')
 *   const debounced = useDebouncedValue(query, 250)
 *   // useMemo / useEffect 안에서 debounced 사용 → keystroke 마다 발화 안 함
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handle)
  }, [value, delay])

  return debounced
}

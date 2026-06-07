import { JSX } from 'react'

interface Props {
  value: string
}

/**
 * 셀 값 표시(읽기 전용). 실제 편집/입력은 active 셀 위에 떠 있는 CsvCellEditor 가 담당한다.
 */
export function EditableCell({ value }: Props): JSX.Element {
  return (
    <div className="px-2 py-1 text-sm truncate cursor-text min-h-[28px] h-full">{value || ' '}</div>
  )
}

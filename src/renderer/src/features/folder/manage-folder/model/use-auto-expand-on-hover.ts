import { useEffect, useRef } from 'react'
import type { NodeApi } from 'react-arborist'

const HOVER_OPEN_DELAY_MS = 700

/**
 * 드래그 중 닫힌 폴더 위에 일정 시간 hover하면 자동으로 폴더를 펼친다.
 * (사용자가 깊은 폴더로 드롭할 때 일일이 펼치지 않아도 되도록)
 *
 * @param node react-arborist의 NodeApi
 * @param isHovered 폴더의 into 드롭 슬롯이 활성 상태인지 (dnd.isIntoOver)
 */
export function useAutoExpandOnHover<T>(node: NodeApi<T>, isHovered: boolean): void {
  // node는 매 렌더마다 새 객체일 수 있어 ref로 최신값 유지
  const nodeRef = useRef(node)
  nodeRef.current = node

  useEffect(() => {
    if (!isHovered) return
    if (nodeRef.current.isOpen) return
    const timer = setTimeout(() => {
      nodeRef.current.open()
    }, HOVER_OPEN_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isHovered, node.id, node.isOpen])
}

import { LayoutNode, PaneNode, SplitDirection, SplitNode } from '@/entities/tab-system'
import { isPaneNode, SplitPosition } from './types'
import { createPaneNode, createSplitContainerNode } from '../lib/factory'

// ----------------------------------- 레이아웃 탐색 ----------------------------------- //
// 특정 paneId를 가진 PaneNode를 레이아웃에서 찾는다.
export function findPaneNodeInLayout(layout: LayoutNode, paneId: string): PaneNode | null {
  if (isPaneNode(layout)) {
    return layout.paneId === paneId ? layout : null
  }

  for (const child of layout.children) {
    const result = findPaneNodeInLayout(child, paneId)
    if (result) return result
  }
  return null
}

// 특정 splitNodeId를 가진 SplitNode를 레이아웃에서 찾는다.
export function findSplitNode(
  layout: LayoutNode,
  splitNodeId: string
): { parent: SplitNode; index: number } | null {
  if (isPaneNode(layout)) return null

  for (let i = 0; i < layout.children.length; i++) {
    const child = layout.children[i]
    if (child.id === splitNodeId) return { parent: layout, index: i }
    const found = findSplitNode(child, splitNodeId)
    if (found) return found
  }
  return null
}

// 레이아웃에서 가장 첫 번째 paneId를 찾는다.
export function findFirstPaneId(layout: LayoutNode): string | null {
  if (isPaneNode(layout)) return layout.paneId
  for (const child of layout.children) {
    const paneId = findFirstPaneId(child)
    if (paneId) return paneId
  }
  return null
}

// 레이아웃에서 특정 paneId를 가진 노드가 존재하는지 확인한다.
export function isContainsNode(layout: LayoutNode, nodeId: string): boolean {
  if (layout.id === nodeId) return true
  if (isPaneNode(layout)) return false
  return layout.children.some((child) => isContainsNode(child, nodeId))
}

// 수평 분할된 레이아웃에서 특정 노드의 오른쪽에 있는 paneId를 찾는다.
export function findRightPaneInHorizontalSplit(
  layout: LayoutNode,
  targetNodeId: string
): string | null {
  function search(node: LayoutNode): string | null {
    if (isPaneNode(node)) return null

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]
      const containsTarget = child.id === targetNodeId || isContainsNode(child, targetNodeId)
      if (!containsTarget) continue

      if (node.direction === 'horizontal') {
        for (let j = i + 1; j < node.children.length; j++) {
          const rightPaneId = findFirstPaneId(node.children[j])
          if (rightPaneId) return rightPaneId
        }
      }

      return search(child)
    }

    return null
  }

  return search(layout)
}

// ----------------------------------- 레이아웃 변환 ----------------------------------- //
// 레이아웃에서 targetNodeId를 newNode로 교체한다.
export function replaceNodeInLayout(
  layout: LayoutNode,
  targetNodeId: string,
  newNode: LayoutNode
): LayoutNode {
  if (layout.id === targetNodeId) return newNode
  if (isPaneNode(layout)) return layout

  return {
    ...layout,
    children: layout.children.map((child) => replaceNodeInLayout(child, targetNodeId, newNode))
  }
}

// 특정 SplitNode의 sizes를 업데이트한다.
export function updateSizesInLayout(
  layout: LayoutNode,
  targetNodeId: string,
  newSizes: number[]
): LayoutNode {
  if (isPaneNode(layout)) return layout
  if (layout.id === targetNodeId) return { ...layout, sizes: newSizes }
  return {
    ...layout,
    children: layout.children.map((child) => updateSizesInLayout(child, targetNodeId, newSizes))
  }
}

// sizes 배열에서 특정 인덱스를 제거하고 합이 100이 되도록 정규화한다.
export function removeAndNormalizeSizes(sizes: number[], indexToRemove: number): number[] {
  const newSizes = sizes.filter((_, i) => i !== indexToRemove)
  const sum = newSizes.reduce((a, b) => a + b, 0)
  if (sum === 0) return newSizes.map(() => 100 / newSizes.length)
  return newSizes.map((s) => (s * 100) / sum)
}

// 빈 SplitContainer 제거
export function cleanupLayout(layout: LayoutNode): LayoutNode {
  if (isPaneNode(layout)) return layout

  const cleanedWithIndex: { child: LayoutNode; originalIndex: number }[] = []
  layout.children.forEach((child, index) => {
    const cleaned = cleanupLayout(child)
    const shouldKeep = isPaneNode(cleaned) || (cleaned as SplitNode).children.length > 0
    if (shouldKeep) cleanedWithIndex.push({ child: cleaned, originalIndex: index })
  })

  if (cleanedWithIndex.length === 0) return layout
  if (cleanedWithIndex.length === 1) return cleanedWithIndex[0].child

  const keptSizes = cleanedWithIndex.map(({ originalIndex }) => layout.sizes[originalIndex])
  const sum = keptSizes.reduce((a, b) => a + b, 0)
  const normalizedSizes =
    sum === 0 ? keptSizes.map(() => 100 / keptSizes.length) : keptSizes.map((s) => (s * 100) / sum)

  return {
    ...layout,
    children: cleanedWithIndex.map(({ child }) => child),
    sizes: normalizedSizes
  }
}

// 패인을 레이아웃에 삽입하고 새 레이아웃 반환
export function insertPaneIntoLayout(
  layout: LayoutNode,
  targetPaneId: string,
  newPaneId: string,
  position: SplitPosition
): LayoutNode {
  const direction: SplitDirection =
    position === 'left' || position === 'right' ? 'horizontal' : 'vertical'
  const newPaneFirst = position === 'left' || position === 'top'

  const paneNode = findPaneNodeInLayout(layout, targetPaneId)
  if (!paneNode) return layout

  const newPaneNode = createPaneNode(newPaneId)
  const parentInfo = findSplitNode(layout, paneNode.id)

  // 부모가 같은 방향이면 기존 컨테이너에 삽입
  if (parentInfo && parentInfo.parent.direction === direction) {
    const { parent, index } = parentInfo
    const newChildren = [...parent.children]
    const newSizes = [...parent.sizes]
    const halfSize = newSizes[index] / 2

    if (newPaneFirst) {
      newChildren.splice(index, 0, newPaneNode)
      newSizes.splice(index, 1, halfSize, halfSize)
    } else {
      newChildren.splice(index + 1, 0, newPaneNode)
      newSizes.splice(index, 1, halfSize, halfSize)
    }

    const newParent: SplitNode = { ...parent, children: newChildren, sizes: newSizes }
    return replaceNodeInLayout(layout, parent.id, newParent)
  }

  // 다른 방향이거나 루트면 새 SplitContainer로 감싸기
  const children = newPaneFirst ? [newPaneNode, paneNode] : [paneNode, newPaneNode]
  const newSplitContainer = createSplitContainerNode(direction, children)
  return replaceNodeInLayout(layout, paneNode.id, newSplitContainer)
}

// 패인을 레이아웃에서 제거하고 새 레이아웃 반환
export function removePaneFromLayout(layout: LayoutNode, paneId: string): LayoutNode {
  const paneNode = findPaneNodeInLayout(layout, paneId)
  if (!paneNode) return layout

  const parentInfo = findSplitNode(layout, paneNode.id)
  if (!parentInfo) return layout

  const { parent, index } = parentInfo
  const newChildren = [...parent.children]
  newChildren.splice(index, 1)

  let newLayout: LayoutNode
  if (newChildren.length === 1) {
    newLayout = replaceNodeInLayout(layout, parent.id, newChildren[0])
  } else {
    const newParent: SplitNode = {
      ...parent,
      children: newChildren,
      sizes: removeAndNormalizeSizes(parent.sizes, index)
    }
    newLayout = replaceNodeInLayout(layout, parent.id, newParent)
  }

  return cleanupLayout(newLayout)
}

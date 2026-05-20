/**
 * nested 트리 + openState → flat row 변환.
 *
 * react-arborist 가 내부적으로 수행하던 DFS preorder + openState 필터를 그대로 재현한다.
 * 각 row 는 NodeApi 합성에 필요한 메타(level/childIndex/parentId/isLeaf) 를 함께 보관한다.
 */

export interface FlatRow<T> {
  /** 원본 노드. */
  data: T
  /** 노드 id (idAccessor 결과). */
  id: string
  /** 0-based depth. 루트 = 0. */
  level: number
  /** 부모 children 배열에서의 인덱스. */
  childIndex: number
  /** 부모 노드 id. 루트의 부모는 null. */
  parentId: string | null
  /** 자식이 한 명이라도 있으면 false, 아니면 true. (leaf = no children) */
  isLeaf: boolean
}

export function flattenTree<T>(
  data: T[],
  idAccessor: (n: T) => string,
  childrenAccessor: (n: T) => T[] | null,
  openState: Record<string, boolean>
): FlatRow<T>[] {
  const result: FlatRow<T>[] = []
  walk(data, idAccessor, childrenAccessor, openState, 0, null, result)
  return result
}

function walk<T>(
  nodes: T[],
  idAccessor: (n: T) => string,
  childrenAccessor: (n: T) => T[] | null,
  openState: Record<string, boolean>,
  level: number,
  parentId: string | null,
  out: FlatRow<T>[]
): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const id = idAccessor(node)
    const children = childrenAccessor(node)
    const isLeaf = children === null
    out.push({ data: node, id, level, childIndex: i, parentId, isLeaf })
    if (!isLeaf && children !== null && openState[id]) {
      walk(children, idAccessor, childrenAccessor, openState, level + 1, id, out)
    }
  }
}

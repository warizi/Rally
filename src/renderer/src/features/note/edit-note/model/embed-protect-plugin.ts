/**
 * 임베드 노드 보호 plugin — appendTransaction.
 *
 * schema 의 `marks: ''` 만으로는 selection 이 임베드 위를 가로지르며 mark 가
 * 적용되는 케이스를 완전히 못 막는다 (inline-toolbar 가 paragraph 의 inline
 * content 에 일괄 addMark → 임베드 노드도 포함).
 *
 * 이 plugin 은 매 transaction 후 doc 을 traverse 해서 임베드 노드에 mark 가
 * 붙어있으면 모두 제거하는 cleanup transaction 을 append.
 *
 * → 사용자가 색상 / 굵게 / 인라인 code 를 적용해도 임베드는 항상 plain 상태로
 *   유지 → markdown round-trip 도 깨지지 않는다.
 */
import { $prose } from '@milkdown/kit/utils'
import { Plugin } from '@milkdown/kit/prose/state'
import { RALLY_EMBED_NODE_NAME } from './note-embed-schema'

export const embedProtectPlugin = $prose(
  () =>
    new Plugin({
      appendTransaction: (_trs, _oldState, newState) => {
        const tr = newState.tr
        let mutated = false
        newState.doc.descendants((node, pos) => {
          if (node.type.name !== RALLY_EMBED_NODE_NAME) return true
          if (node.marks.length === 0) return false
          for (const mark of node.marks) {
            tr.removeMark(pos, pos + node.nodeSize, mark.type)
            mutated = true
          }
          return false
        })
        return mutated ? tr : null
      }
    })
)

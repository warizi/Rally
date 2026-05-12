import { NotFoundError } from '../../../lib/errors'
import { canvasRepository } from '../../../repositories/canvas'
import { canvasNodeRepository } from '../../../repositories/canvas-node'
import { canvasEdgeRepository } from '../../../repositories/canvas-edge'
import { canvasGroupRepository } from '../../../repositories/canvas-group'
import { emptyCollected, type CollectedRows } from '../cascade-collector'
import type { SoftDeleteHandler } from './handler.interface'

/**
 * canvas → nodes + edges + groups cascade 수집.
 *
 * 첫 번째 추출된 핸들러 — 다른 entity 와 의존 관계가 가장 적어서 안전하게 이전 가능.
 * workspaceId / batchId 컨텍스트는 사용하지 않음 (canvas 는 FS 파일 없음).
 */
export const canvasHandler: SoftDeleteHandler<'canvas'> = {
  entityType: 'canvas',

  collectCascade(rootId: string): CollectedRows {
    const root = canvasRepository.findByIdIncludingDeleted(rootId)
    if (!root) throw new NotFoundError(`Canvas not found: ${rootId}`)
    const nodes = canvasNodeRepository.findByCanvasIdIncludingDeleted(rootId)
    const edges = canvasEdgeRepository.findByCanvasIdIncludingDeleted(rootId)
    const groups = canvasGroupRepository.findByCanvasIdIncludingDeleted(rootId)
    return {
      ...emptyCollected(),
      canvasIds: [rootId],
      canvasNodeIds: nodes.map((n) => n.id),
      canvasEdgeIds: edges.map((e) => e.id),
      canvasGroupIds: groups.map((g) => g.id),
      rootTitle: root.title
    }
  }
}

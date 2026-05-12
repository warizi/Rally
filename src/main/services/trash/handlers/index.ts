/**
 * 휴지통 도메인 핸들러 — 점진 이전 중.
 *
 * 현재 등록된 entity: canvas (Phase 2)
 * 추후: todo, schedule, recurring_rule, template, note, csv, pdf, image, folder (Phase 3)
 *
 * import 시 부수효과로 registry 에 자동 등록 (등록 누락 방지).
 */
import { registerTrashHandler } from './registry'
import { canvasHandler } from './canvas.handler'

registerTrashHandler(canvasHandler)

export { registerTrashHandler, getTrashHandler, listRegisteredHandlers } from './registry'
export type { SoftDeleteHandler, HandlerContext } from './handler.interface'

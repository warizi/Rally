/**
 * 휴지통 도메인 핸들러 — 모든 entity 등록.
 *
 * import 부수효과로 registry 자동 등록. 신규 entity 추가 시:
 *   1. `./{new}.handler.ts` 작성
 *   2. 본 파일 import + registerTrashHandler 한 줄
 *
 * Phase 3 종료 상태 — 10개 entity 모두 handler 보유 (canvas/todo/schedule/
 * recurring_rule/template/note/csv/pdf/image/folder).
 */
import { registerTrashHandler } from './registry'
import { canvasHandler } from './canvas.handler'
import { todoHandler } from './todo.handler'
import { scheduleHandler } from './schedule.handler'
import { recurringRuleHandler } from './recurring-rule.handler'
import { templateHandler } from './template.handler'
import { noteHandler } from './note.handler'
import { csvHandler } from './csv.handler'
import { pdfHandler } from './pdf.handler'
import { imageHandler } from './image.handler'
import { folderHandler } from './folder.handler'

registerTrashHandler(canvasHandler)
registerTrashHandler(todoHandler)
registerTrashHandler(scheduleHandler)
registerTrashHandler(recurringRuleHandler)
registerTrashHandler(templateHandler)
registerTrashHandler(noteHandler)
registerTrashHandler(csvHandler)
registerTrashHandler(pdfHandler)
registerTrashHandler(imageHandler)
registerTrashHandler(folderHandler)

export { registerTrashHandler, getTrashHandler, listRegisteredHandlers } from './registry'
export type { SoftDeleteHandler, HandlerContext } from './handler.interface'

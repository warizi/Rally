import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

/**
 * 휴지통 batch — 한 번의 사용자/AI 삭제 액션이 묶이는 단위.
 * cascade 자식(예: 폴더 삭제 시 하위 노트들)은 모두 같은 batchId를 공유한다.
 *
 * 휴지통 UI는 batch 1개 = 카드 1개로 표시 (자식은 펼치기로 노출).
 * 복구·영구 삭제도 batch 단위 atomic.
 */
export const trashBatches = sqliteTable(
  'trash_batches',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** 휴지통 카드 표시용: 사용자가 실제로 삭제 액션한 root entity 종류 */
    rootEntityType: text('root_entity_type').notNull(),
    rootEntityId: text('root_entity_id').notNull(),
    /** 캐시된 root 제목 (실제 row가 trash 안에서도 UI에 보이게) */
    rootTitle: text('root_title').notNull(),
    /** cascade로 함께 묶인 자식 row 수 */
    childCount: integer('child_count').notNull().default(0),
    /**
     * FS 파일이 있는 도메인(folder/note/csv/pdf/image)은 워크스페이스 밖
     * `<userData>/.trash/<wsId>/<batchId>/...`로 이동 — 그 절대경로 캐시
     */
    fsTrashPath: text('fs_trash_path'),
    /**
     * 복구 시 재생성할 entity_links / reminders 등의 JSON snapshot.
     * key: 'entity_links' | 'reminders' | ...
     */
    metadata: text('metadata'),
    /** 삭제 발생 시각 (auto-sweep 기준) */
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }).notNull(),
    /** 'user_action' | 'mcp' | 'auto_sweep_pending' — 디버깅·감사용 */
    reason: text('reason')
  },
  (t) => [
    index('idx_trash_batches_workspace_deleted').on(t.workspaceId, t.deletedAt),
    index('idx_trash_batches_root').on(t.rootEntityType, t.rootEntityId)
  ]
)

export type TrashBatchEntityKind =
  | 'folder'
  | 'note'
  | 'csv'
  | 'pdf'
  | 'image'
  | 'canvas'
  | 'todo'
  | 'schedule'
  | 'recurring_rule'

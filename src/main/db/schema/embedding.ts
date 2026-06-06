import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export type EmbeddableEntityType = 'note' | 'todo' | 'schedule' | 'csv' | 'canvas'

export const EMBEDDABLE_ENTITY_TYPES: EmbeddableEntityType[] = [
  'canvas',
  'csv',
  'note',
  'schedule',
  'todo'
]

/**
 * 임베딩 메타. 실제 벡터는 sqlite-vec 가상 테이블 `vec_embeddings`(rowid 기준)에 저장.
 * 이 테이블은 "어떤 엔티티의 어느 청크가 어느 rowid 벡터인지" + 변경 감지(contentHash)를 담당.
 * - 한 엔티티가 여러 청크로 나뉘면 (entityType, entityId)당 여러 행.
 * - rowid는 vec_embeddings.rowid와 1:1 매핑.
 */
export const embeddingMeta = sqliteTable(
  'embedding_meta',
  {
    // `${entityType}:${entityId}:${chunkIndex}`
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    // vec_embeddings의 rowid (vec0는 정수 rowid만 PK로 사용)
    rowid: integer('rowid').notNull(),
    // 청크 내용 해시 — 동일하면 재임베딩 skip
    contentHash: text('content_hash').notNull(),
    // 임베딩 모델 식별자 — 모델 교체 시 구버전 식별/재임베딩용
    model: text('model').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    index('idx_embedding_meta_entity').on(t.entityType, t.entityId),
    index('idx_embedding_meta_rowid').on(t.rowid),
    index('idx_embedding_meta_workspace').on(t.workspaceId)
  ]
)

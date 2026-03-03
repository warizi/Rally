# Design: Link 기능

## 1. 개요

Plan 문서 기반 상세 설계서. 5개 엔티티(todo, schedule, note, pdf, csv) 간 범용 다대다 링크 시스템.

**참조**: `docs/01-plan/features/link.plan.md`

---

## 2. DB 스키마

### 2.1 entity_links 테이블

**파일**: `src/main/db/schema/entity-link.ts`

```typescript
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export const entityLinks = sqliteTable(
  'entity_links',
  {
    sourceType: text('source_type').notNull(), // 'csv' | 'note' | 'pdf' | 'schedule' | 'todo'
    sourceId: text('source_id').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    primaryKey({ columns: [t.sourceType, t.sourceId, t.targetType, t.targetId] }),
    index('idx_entity_links_target').on(t.targetType, t.targetId),
    index('idx_entity_links_workspace').on(t.workspaceId)
  ]
)
```

**설계 근거**:

| 컬럼                  | 설명                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `sourceType/sourceId` | 정규화된 순서의 첫 번째 엔티티 (type 알파벳순)                                                          |
| `targetType/targetId` | 정규화된 순서의 두 번째 엔티티                                                                          |
| `workspaceId`         | **workspace 삭제 시 cascade** + 크로스 워크스페이스 방지                                                |
| `createdAt`           | 링크 생성 시각 (서비스 레이어에서 `new Date()` 주입 — 기존 스키마와 동일한 `integer timestamp_ms` 사용) |

**workspaceId 추가 이유**: entity_links는 폴리모픽 테이블이라 source/target에 FK를 걸 수 없다. 하지만 workspace에는 FK를 걸 수 있고, 이를 통해:

1. workspace 삭제 시 모든 링크 자동 cascade
2. 크로스 워크스페이스 링크를 DB 레벨에서도 제약

### 2.2 정규화 규칙

저장 시 (sourceType, targetType) 쌍을 **알파벳순으로 정렬**:

```
알파벳순: csv < note < pdf < schedule < todo
```

예시:

- todo ↔ note 링크 → source=note, target=todo
- schedule ↔ csv 링크 → source=csv, target=schedule
- todo ↔ todo (다른 ID) → source=todo(id가 작은 쪽), target=todo(id가 큰 쪽)

```typescript
function normalize(
  typeA: LinkableEntityType,
  idA: string,
  typeB: LinkableEntityType,
  idB: string
): { sourceType; sourceId; targetType; targetId } {
  if (typeA < typeB) return { sourceType: typeA, sourceId: idA, targetType: typeB, targetId: idB }
  if (typeA > typeB) return { sourceType: typeB, sourceId: idB, targetType: typeA, targetId: idA }
  // 같은 타입: id 비교
  if (idA < idB) return { sourceType: typeA, sourceId: idA, targetType: typeB, targetId: idB }
  return { sourceType: typeB, sourceId: idB, targetType: typeA, targetId: idA }
}
```

### 2.3 schema/index.ts 수정

```typescript
// 추가
import { entityLinks } from './entity-link'

export {
  // ... 기존 exports
  entityLinks
}
```

---

## 3. 공유 타입

### 3.1 LinkableEntityType

**파일**: `src/main/db/schema/entity-link.ts` (스키마와 같은 파일에 export)

```typescript
export type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv'

export const LINKABLE_ENTITY_TYPES: LinkableEntityType[] = [
  'csv',
  'note',
  'pdf',
  'schedule',
  'todo'
]
```

### 3.2 LinkedEntity (조회 결과 타입)

**파일**: `src/main/services/entity-link.ts` (서비스에서 정의)

```typescript
export interface LinkedEntity {
  entityType: LinkableEntityType
  entityId: string
  title: string
  linkedAt: Date // createdAt of the link (integer timestamp_ms → Date)
}
```

### 3.3 Preload 타입

**파일**: `src/preload/index.d.ts` (추가)

```typescript
interface EntityLinkAPI {
  link: (
    sourceType: LinkableEntityType,
    sourceId: string,
    targetType: LinkableEntityType,
    targetId: string,
    workspaceId: string
  ) => Promise<IpcResponse<void>>
  unlink: (
    sourceType: LinkableEntityType,
    sourceId: string,
    targetType: LinkableEntityType,
    targetId: string
  ) => Promise<IpcResponse<void>>
  getLinked: (
    entityType: LinkableEntityType,
    entityId: string
  ) => Promise<IpcResponse<LinkedEntity[]>>
}

interface API {
  // ... 기존
  entityLink: EntityLinkAPI
}
```

---

## 4. Repository 레이어

**파일**: `src/main/repositories/entity-link.ts`

```typescript
import { and, eq, or } from 'drizzle-orm'
import { db } from '../db'
import { entityLinks } from '../db/schema'

export type EntityLink = typeof entityLinks.$inferSelect
export type EntityLinkInsert = typeof entityLinks.$inferInsert

export const entityLinkRepository = {
  link(data: EntityLinkInsert): void {
    db.insert(entityLinks).values(data).onConflictDoNothing().run()
  },

  unlink(sourceType: string, sourceId: string, targetType: string, targetId: string): void {
    db.delete(entityLinks)
      .where(
        and(
          eq(entityLinks.sourceType, sourceType),
          eq(entityLinks.sourceId, sourceId),
          eq(entityLinks.targetType, targetType),
          eq(entityLinks.targetId, targetId)
        )
      )
      .run()
  },

  findByEntity(entityType: string, entityId: string): EntityLink[] {
    return db
      .select()
      .from(entityLinks)
      .where(
        or(
          and(eq(entityLinks.sourceType, entityType), eq(entityLinks.sourceId, entityId)),
          and(eq(entityLinks.targetType, entityType), eq(entityLinks.targetId, entityId))
        )
      )
      .all()
  },

  removeAllByEntity(entityType: string, entityId: string): void {
    db.delete(entityLinks)
      .where(
        or(
          and(eq(entityLinks.sourceType, entityType), eq(entityLinks.sourceId, entityId)),
          and(eq(entityLinks.targetType, entityType), eq(entityLinks.targetId, entityId))
        )
      )
      .run()
  },

  removeAllByEntities(entityType: string, entityIds: string[]): void {
    // subtodo cascade 대응: 여러 ID 한번에 정리
    // inArray 사용
    for (const id of entityIds) {
      this.removeAllByEntity(entityType, id)
    }
  }
}
```

**설계 포인트**:

- `link()`: `onConflictDoNothing()`으로 중복 무시 (EC-06)
- `unlink()`: 존재하지 않아도 에러 없음 (EC-07)
- `findByEntity()`: **양방향 조회** — source 또는 target 중 하나에 매칭
- `removeAllByEntity()`: 엔티티 삭제 전 호출하여 고아 링크 방지 (EC-04)
- `removeAllByEntities()`: subtodo cascade 대응 (EC-10)

---

## 5. Service 레이어

**파일**: `src/main/services/entity-link.ts`

```typescript
import { entityLinkRepository } from '../repositories/entity-link'
import { todoRepository } from '../repositories/todo'
import { scheduleRepository } from '../repositories/schedule'
import { noteRepository } from '../repositories/note'
import { pdfFileRepository } from '../repositories/pdf-file'
import { csvFileRepository } from '../repositories/csv-file'
import { NotFoundError, ValidationError } from '../lib/errors'
import type { LinkableEntityType } from '../db/schema/entity-link'

export interface LinkedEntity {
  entityType: LinkableEntityType
  entityId: string
  title: string
  linkedAt: Date
}

// 엔티티 타입별 repository 매핑
function findEntity(type: LinkableEntityType, id: string) {
  switch (type) {
    case 'todo':
      return todoRepository.findById(id)
    case 'schedule':
      return scheduleRepository.findById(id)
    case 'note':
      return noteRepository.findById(id)
    case 'pdf':
      return pdfFileRepository.findById(id)
    case 'csv':
      return csvFileRepository.findById(id)
  }
}

function getWorkspaceId(type: LinkableEntityType, entity: any): string {
  // 주의: schedules.workspaceId는 nullable (스키마에 .notNull() 없음)
  const wsId = entity.workspaceId
  if (!wsId) throw new ValidationError(`Entity ${type} has no workspaceId`)
  return wsId
}

function getTitle(type: LinkableEntityType, entity: any): string {
  return entity.title
}

function normalize(typeA: LinkableEntityType, idA: string, typeB: LinkableEntityType, idB: string) {
  if (typeA < typeB) return { sourceType: typeA, sourceId: idA, targetType: typeB, targetId: idB }
  if (typeA > typeB) return { sourceType: typeB, sourceId: idB, targetType: typeA, targetId: idA }
  if (idA < idB) return { sourceType: typeA, sourceId: idA, targetType: typeB, targetId: idB }
  return { sourceType: typeB, sourceId: idB, targetType: typeA, targetId: idA }
}

export const entityLinkService = {
  link(
    typeA: LinkableEntityType,
    idA: string,
    typeB: LinkableEntityType,
    idB: string,
    workspaceId: string
  ): void {
    // EC-01: 자기 자신 링크 방지
    if (typeA === typeB && idA === idB) {
      throw new ValidationError('Cannot link an entity to itself')
    }

    // EC-02: 존재 여부 확인
    const entityA = findEntity(typeA, idA)
    if (!entityA) throw new NotFoundError(`${typeA} not found: ${idA}`)
    const entityB = findEntity(typeB, idB)
    if (!entityB) throw new NotFoundError(`${typeB} not found: ${idB}`)

    // EC-03: 크로스 워크스페이스 방지
    const wsA = getWorkspaceId(typeA, entityA)
    const wsB = getWorkspaceId(typeB, entityB)
    if (wsA !== wsB) {
      throw new ValidationError('Cannot link entities from different workspaces')
    }
    if (wsA !== workspaceId) {
      throw new ValidationError('Workspace mismatch')
    }

    // 정규화 후 저장
    const normalized = normalize(typeA, idA, typeB, idB)
    entityLinkRepository.link({
      ...normalized,
      workspaceId,
      createdAt: new Date()
    })
  },

  unlink(typeA: LinkableEntityType, idA: string, typeB: LinkableEntityType, idB: string): void {
    const normalized = normalize(typeA, idA, typeB, idB)
    entityLinkRepository.unlink(
      normalized.sourceType,
      normalized.sourceId,
      normalized.targetType,
      normalized.targetId
    )
  },

  getLinked(entityType: LinkableEntityType, entityId: string): LinkedEntity[] {
    const rows = entityLinkRepository.findByEntity(entityType, entityId)
    const result: LinkedEntity[] = []
    const orphanRows: {
      sourceType: string
      sourceId: string
      targetType: string
      targetId: string
    }[] = []

    for (const row of rows) {
      // 상대편 엔티티 추출
      const isSource = row.sourceType === entityType && row.sourceId === entityId
      const linkedType = (isSource ? row.targetType : row.sourceType) as LinkableEntityType
      const linkedId = isSource ? row.targetId : row.sourceId

      const entity = findEntity(linkedType, linkedId)
      if (!entity) {
        // EC-09: 삭제된 엔티티 → 고아 링크 정리
        orphanRows.push(row)
        continue
      }

      result.push({
        entityType: linkedType,
        entityId: linkedId,
        title: getTitle(linkedType, entity),
        linkedAt: row.createdAt
      })
    }

    // 고아 링크 동기 정리 (조회 시 발견된 미존재 엔티티의 링크 제거)
    for (const orphan of orphanRows) {
      entityLinkRepository.unlink(
        orphan.sourceType,
        orphan.sourceId,
        orphan.targetType,
        orphan.targetId
      )
    }

    return result
  },

  // EC-04: 엔티티 삭제 시 호출
  removeAllLinks(entityType: LinkableEntityType, entityId: string): void {
    entityLinkRepository.removeAllByEntity(entityType, entityId)
  },

  // EC-10: Todo + subtodo 일괄 정리
  removeAllLinksForTodos(todoIds: string[]): void {
    entityLinkRepository.removeAllByEntities('todo', todoIds)
  }
}
```

---

## 6. IPC 핸들러

**파일**: `src/main/ipc/entity-link.ts`

```typescript
import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { handle } from '../lib/handle'
import type { IpcResponse } from '../lib/ipc-response'
import { entityLinkService } from '../services/entity-link'
import type { LinkableEntityType } from '../db/schema/entity-link'

export function registerEntityLinkHandlers(): void {
  ipcMain.handle(
    'entityLink:link',
    (
      _: IpcMainInvokeEvent,
      typeA: LinkableEntityType,
      idA: string,
      typeB: LinkableEntityType,
      idB: string,
      workspaceId: string
    ): IpcResponse => handle(() => entityLinkService.link(typeA, idA, typeB, idB, workspaceId))
  )

  ipcMain.handle(
    'entityLink:unlink',
    (
      _: IpcMainInvokeEvent,
      typeA: LinkableEntityType,
      idA: string,
      typeB: LinkableEntityType,
      idB: string
    ): IpcResponse => handle(() => entityLinkService.unlink(typeA, idA, typeB, idB))
  )

  ipcMain.handle(
    'entityLink:getLinked',
    (_: IpcMainInvokeEvent, entityType: LinkableEntityType, entityId: string): IpcResponse =>
      handle(() => entityLinkService.getLinked(entityType, entityId))
  )
}
```

**IPC 등록**: `src/main/index.ts`에서 `registerEntityLinkHandlers()` 호출 추가 (기존 `registerScheduleHandlers()` 등과 동일 네이밍).

---

## 7. Preload Bridge

**파일**: `src/preload/index.ts` (추가)

```typescript
entityLink: {
  link: (typeA: string, idA: string, typeB: string, idB: string, workspaceId: string) =>
    ipcRenderer.invoke('entityLink:link', typeA, idA, typeB, idB, workspaceId),
  unlink: (typeA: string, idA: string, typeB: string, idB: string) =>
    ipcRenderer.invoke('entityLink:unlink', typeA, idA, typeB, idB),
  getLinked: (entityType: string, entityId: string) =>
    ipcRenderer.invoke('entityLink:getLinked', entityType, entityId),
},
```

---

## 8. 기존 서비스 수정 (링크 정리)

각 엔티티의 `remove` 메서드에 링크 정리 호출을 추가한다.

### 8.1 todoService.remove 수정

**파일**: `src/main/services/todo.ts` (약 line 200)

```typescript
remove(todoId: string): void {
  const todo = todoRepository.findById(todoId)
  if (!todo) throw new NotFoundError(`Todo not found: ${todoId}`)

  // 링크 정리: 본인 + 하위 todo
  const subtodoIds = todoRepository.findAllDescendantIds(todoId) // 새로 추가할 메서드
  entityLinkService.removeAllLinksForTodos([todoId, ...subtodoIds])

  todoRepository.delete(todoId) // DB FK cascade로 subtodo 삭제
}
```

**todoRepository 추가 메서드** (반복적 BFS 방식 — 재귀 스택 오버플로우 방지):

```typescript
findAllDescendantIds(parentId: string): string[] {
  const result: string[] = []
  const queue = [parentId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    const children = db
      .select({ id: todos.id })
      .from(todos)
      .where(eq(todos.parentId, currentId))
      .all()
    for (const child of children) {
      result.push(child.id)
      queue.push(child.id)
    }
  }

  return result
}
```

**설계 근거**: 재귀 대신 BFS(너비 우선 탐색) 사용. 깊은 todo 계층에서도 스택 오버플로우 없이 안전하게 동작. SQLite의 WITH RECURSIVE CTE도 대안이나, Drizzle ORM에서 raw SQL 없이 구현 가능한 BFS가 더 일관적.

### 8.2 scheduleService.remove 수정

**파일**: `src/main/services/schedule.ts` (약 line 239)

```typescript
remove(scheduleId: string): void {
  const existing = scheduleRepository.findById(scheduleId)
  if (!existing) throw new NotFoundError('일정을 찾을 수 없습니다')

  entityLinkService.removeAllLinks('schedule', scheduleId)
  scheduleRepository.delete(scheduleId)
}
```

### 8.3 noteService.remove 수정

**파일**: `src/main/services/note.ts` (약 line 231)

```typescript
remove(workspaceId: string, noteId: string): void {
  // ... 기존 workspace/note 검증, 파일 삭제 ...

  entityLinkService.removeAllLinks('note', noteId)
  noteRepository.delete(noteId)
}
```

### 8.4 pdfFileService.remove 수정

**파일**: `src/main/services/pdf-file.ts` (약 line 205)

```typescript
remove(workspaceId: string, pdfId: string): void {
  // ... 기존 workspace/pdf 검증, 파일 삭제 ...

  entityLinkService.removeAllLinks('pdf', pdfId)
  pdfFileRepository.delete(pdfId)
}
```

### 8.5 csvFileService.remove 수정

**파일**: `src/main/services/csv-file.ts` (약 line 227)

```typescript
remove(workspaceId: string, csvId: string): void {
  // ... 기존 workspace/csv 검증, 파일 삭제 ...

  entityLinkService.removeAllLinks('csv', csvId)
  csvFileRepository.delete(csvId)
}
```

### 8.6 Workspace 삭제

Workspace 삭제 시 `entity_links.workspaceId` FK cascade로 **자동 정리**됨. 추가 코드 불필요.

### 8.7 파일 워처 외부 삭제 (EC-05)

**파일**: `src/main/services/workspace-watcher.ts`

파일 워처는 서비스 레이어를 거치지 않고 **repository를 직접 호출**하므로, 링크 정리도 `entityLinkRepository`를 직접 사용한다.

**Note 삭제** (Step 5, line 402):

```typescript
// 기존: noteRepository.delete(existing.id)
// 수정:
entityLinkRepository.removeAllByEntity('note', existing.id)
noteRepository.delete(existing.id)
```

**CSV 삭제** (Step 8, line 488):

```typescript
// 기존: csvFileRepository.delete(existing.id)
// 수정:
entityLinkRepository.removeAllByEntity('csv', existing.id)
csvFileRepository.delete(existing.id)
```

**PDF 삭제** (Step 11, line 574):

```typescript
// 기존: pdfFileRepository.delete(existing.id)
// 수정:
entityLinkRepository.removeAllByEntity('pdf', existing.id)
pdfFileRepository.delete(existing.id)
```

**import 추가** (파일 상단):

```typescript
import { entityLinkRepository } from '../repositories/entity-link'
```

**설계 근거**: 워처는 이미 repository를 직접 사용하는 패턴이므로, service 레이어를 경유하지 않고 같은 레벨의 `entityLinkRepository`를 사용한다.

---

## 9. Renderer: React Query Hooks

**파일**: `src/renderer/src/entities/entity-link/model/queries.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { LinkedEntity, LinkableEntityType } from '@shared/lib/entity-link'

const ENTITY_LINK_KEY = 'entityLink'

export function useLinkedEntities(entityType: LinkableEntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: [ENTITY_LINK_KEY, entityType, entityId],
    queryFn: async (): Promise<LinkedEntity[]> => {
      const res: IpcResponse<LinkedEntity[]> = await window.api.entityLink.getLinked(
        entityType,
        entityId!
      )
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!entityId
  })
}

export function useLinkEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      typeA,
      idA,
      typeB,
      idB,
      workspaceId
    }: {
      typeA: LinkableEntityType
      idA: string
      typeB: LinkableEntityType
      idB: string
      workspaceId: string
    }) => {
      const res = await window.api.entityLink.link(typeA, idA, typeB, idB, workspaceId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { typeA, idA, typeB, idB }) => {
      // 양쪽 엔티티의 링크 목록 모두 invalidate
      queryClient.invalidateQueries({ queryKey: [ENTITY_LINK_KEY, typeA, idA] })
      queryClient.invalidateQueries({ queryKey: [ENTITY_LINK_KEY, typeB, idB] })
    }
  })
}

export function useUnlinkEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      typeA,
      idA,
      typeB,
      idB
    }: {
      typeA: LinkableEntityType
      idA: string
      typeB: LinkableEntityType
      idB: string
    }) => {
      const res = await window.api.entityLink.unlink(typeA, idA, typeB, idB)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { typeA, idA, typeB, idB }) => {
      queryClient.invalidateQueries({ queryKey: [ENTITY_LINK_KEY, typeA, idA] })
      queryClient.invalidateQueries({ queryKey: [ENTITY_LINK_KEY, typeB, idB] })
    }
  })
}
```

### Entity Barrel Export

**파일**: `src/renderer/src/entities/entity-link/index.ts`

```typescript
export { useLinkedEntities, useLinkEntity, useUnlinkEntity } from './model/queries'
// 타입은 shared에서 re-export (FSD: entities → shared 방향만 허용)
export type { LinkedEntity, LinkableEntityType } from '@shared/lib/entity-link'
```

**주의**: `LinkableEntityType`과 `LinkedEntity`는 `shared/lib/entity-link.ts`에 정의.
entities 레이어에서는 re-export만 한다. 별도 `model/types.ts` 파일 불필요.

---

## 10. Renderer: 공통 UI 컴포넌트

### 10.1 FSD 배치

```
src/renderer/src/
├── shared/lib/
│   └── entity-link.ts             # 타입 + openTab 매핑 + 아이콘 config (shared 레이어)
├── entities/entity-link/          # 데이터 레이어 (hooks, types re-export)
│   ├── model/
│   │   └── queries.ts
│   └── index.ts
└── features/entity-link/          # 기능 레이어 (링크 관리 UI)
    ├── ui/
    │   ├── LinkedEntitySection.tsx
    │   ├── LinkedEntityItem.tsx
    │   ├── LinkEntityPopover.tsx
    │   └── LinkedEntityPopoverButton.tsx  # PDF/CSV 전용
    └── index.ts
```

**FSD 레이어 규칙 준수**:

- `LinkableEntityType`, `LinkedEntity` 타입, `getLinkTabOptions()`, `ENTITY_TYPE_CONFIG` → **shared** 레이어에 정의
- `entities/entity-link` → shared에서 타입 import, React Query hooks 정의
- `features/entity-link` → entities와 shared에서 import
- shared가 entities를 import하면 **FSD 위반**이므로, 모든 공유 타입/유틸은 반드시 shared에 위치

### 10.2 shared/lib/entity-link.ts

**파일**: `src/renderer/src/shared/lib/entity-link.ts`

타입, openTab 매핑, 아이콘 config를 **shared 레이어**에 통합 정의. (FSD: shared는 상위 레이어를 import할 수 없으므로 여기에 위치)

```typescript
// === 공유 타입 ===
export type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv'

export interface LinkedEntity {
  entityType: LinkableEntityType
  entityId: string
  title: string
  linkedAt: Date
}

// === openTab 매핑 ===
export function getLinkTabOptions(entityType: LinkableEntityType, entityId: string, title: string) {
  switch (entityType) {
    case 'todo':
      return {
        type: 'todo-detail' as const,
        pathname: `/todo/${entityId}`,
        title,
        icon: 'todo-detail' as const
      }
    case 'schedule':
      return {
        type: 'calendar' as const,
        pathname: '/calendar',
        searchParams: { scheduleId: entityId },
        title: '캘린더',
        icon: 'calendar' as const,
        updateSearchParams: true
      }
    case 'note':
      return {
        type: 'note' as const,
        pathname: `/folder/note/${entityId}`,
        title,
        icon: 'note' as const
      }
    case 'pdf':
      return {
        type: 'pdf' as const,
        pathname: `/folder/pdf/${entityId}`,
        title,
        icon: 'pdf' as const
      }
    case 'csv':
      return {
        type: 'csv' as const,
        pathname: `/folder/csv/${entityId}`,
        title,
        icon: 'csv' as const
      }
  }
}
```

### 10.3 엔티티 타입 아이콘/라벨 매핑

**파일**: `src/renderer/src/shared/lib/entity-link.ts` (같은 파일 하단)

```typescript
import { Calendar, Check, FileText, Sheet } from 'lucide-react'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'

// === 아이콘/라벨 매핑 ===
export const ENTITY_TYPE_CONFIG: Record<
  LinkableEntityType,
  {
    icon: React.ElementType
    label: string
    color: string
  }
> = {
  todo: { icon: Check, label: '할 일', color: 'text-blue-500' },
  schedule: { icon: Calendar, label: '일정', color: 'text-orange-500' },
  note: { icon: FileText, label: '노트', color: 'text-gray-500' },
  pdf: { icon: PdfIcon, label: 'PDF', color: 'text-red-500' },
  csv: { icon: Sheet, label: '테이블', color: 'text-green-500' }
}
```

### 10.4 LinkedEntitySection

**파일**: `src/renderer/src/features/entity-link/ui/LinkedEntitySection.tsx`

SubTodoSection 패턴을 따르는 접기/펼치기 가능한 링크 섹션.

```
┌─────────────────────────────────────────┐
│ ▶ 연결된 항목 (3)                    [+] │  ← 헤더: 토글 + 카운트 + 추가 버튼
├─────────────────────────────────────────┤
│  📝 노트 제목                      [×]  │  ← LinkedEntityItem
│  ✓  할 일 제목                     [×]  │
│  📊 테이블 제목                    [×]  │
└─────────────────────────────────────────┘
```

**Props**:

```typescript
interface LinkedEntitySectionProps {
  entityType: LinkableEntityType // 현재 엔티티 타입
  entityId: string // 현재 엔티티 ID
  workspaceId: string
  excludeTypes?: LinkableEntityType[] // 특정 타입 제외 (선택사항)
}
```

**동작**:

- `useLinkedEntities(entityType, entityId)` 로 데이터 조회
- 접힘/펼침 상태: 로컬 `useState(true)` (기본 펼침)
- 헤더: `ChevronDown/ChevronRight` 아이콘 + "연결된 항목 (N)" + 추가 버튼
- 추가 버튼 클릭 → `LinkEntityPopover` 열기

**상태별 UI**:

- **로딩 중** (`isLoading`): 헤더에 "연결된 항목" 텍스트 + Spinner (카운트 미표시)
- **빈 상태** (`data.length === 0`): "연결된 항목이 없습니다" 메시지 + 추가 버튼
- **에러** (`isError`): 헤더만 표시, 에러 무시 (링크는 핵심 기능이 아니므로)
- **데이터 있음**: 링크 목록 렌더링

### 10.5 LinkedEntityItem

**파일**: `src/renderer/src/features/entity-link/ui/LinkedEntityItem.tsx`

```typescript
interface LinkedEntityItemProps {
  linkedEntity: LinkedEntity
  currentType: LinkableEntityType
  currentId: string
  onUnlink: () => void
}
```

**동작**:

- 엔티티 타입 아이콘 + 컬러 (`ENTITY_TYPE_CONFIG` 참조)
- 제목 표시 (truncate)
- 클릭 시 `openTab(getLinkTabOptions(...))` 호출
- 호버 시 unlink 버튼 (Link2Off 아이콘) 노출: `opacity-0 group-hover:opacity-100`

### 10.6 LinkEntityPopover

**파일**: `src/renderer/src/features/entity-link/ui/LinkEntityPopover.tsx`

TodoLinkPopover 패턴을 확장한 범용 엔티티 선택 팝오버.

```
┌─────────────────────────────────┐
│ 🔍 검색...                       │
├─────────────────────────────────┤
│ [할 일] [일정] [노트] [PDF] [테이블] │ ← 타입 필터 탭
├─────────────────────────────────┤
│  ✓  할 일 제목 A        (연결됨) │
│     할 일 제목 B                │
│     할 일 제목 C                │
│  ... (스크롤)                    │
└─────────────────────────────────┘
```

**Props**:

```typescript
interface LinkEntityPopoverProps {
  entityType: LinkableEntityType
  entityId: string
  workspaceId: string
  linkedEntityIds: Set<string> // 이미 연결된 엔티티 ID 세트 (linkedType+id)
  children: React.ReactNode // trigger
  excludeTypes?: LinkableEntityType[]
}
```

**동작**:

- 타입 필터 탭으로 검색 대상 타입 선택 (기본: 전체)
- 검색어로 title 필터링
- 이미 연결된 항목은 체크 표시 + 비활성화
- 자기 자신(같은 type+id)은 목록에서 제외
- 클릭 시 `linkEntity.mutate(...)` 호출

**데이터 소스**: 각 타입별 기존 query hook 활용 (정확한 hook 이름)

- `useTodosByWorkspace(workspaceId)` — todo 목록
- `useAllSchedulesByWorkspace(workspaceId)` — schedule 목록 (**신규 hook, 아래 참조**)
- `useNotesByWorkspace(workspaceId)` — note 목록
- `usePdfFilesByWorkspace(workspaceId)` — pdf 목록 (**File 접미사 주의**)
- `useCsvFilesByWorkspace(workspaceId)` — csv 목록 (**File 접미사 주의**)

> **⚠️ 주의**: 기존 `useSchedulesByWorkspace(workspaceId, range)`는 캘린더 표시용으로 반드시 `ScheduleDateRange`가 필요하다.
> 링크 팝오버에서는 전체 일정 목록이 필요하므로 **별도 파이프라인**이 필요하다.
>
> **추가 구현 항목** (schedule 전체 조회):
>
> 1. **Repository** (`src/main/repositories/schedule.ts`):
>
> ```typescript
> findAllByWorkspaceId(workspaceId: string): Schedule[] {
>   return db
>     .select()
>     .from(schedules)
>     .where(eq(schedules.workspaceId, workspaceId))
>     .orderBy(schedules.startAt)
>     .all()
> }
> ```
>
> 2. **Service** (`src/main/services/schedule.ts`):
>
> ```typescript
> findAllByWorkspace(workspaceId: string): Schedule[] {
>   return scheduleRepository.findAllByWorkspaceId(workspaceId)
> }
> ```
>
> 3. **IPC** (`src/main/ipc/schedule.ts`):
>
> ```typescript
> ipcMain.handle('schedule:findAllByWorkspace', (_, workspaceId: string) =>
>   handle(() => scheduleService.findAllByWorkspace(workspaceId))
> )
> ```
>
> 4. **Preload** (`src/preload/index.ts`):
>
> ```typescript
> findAllByWorkspace: (workspaceId: string) =>
>   ipcRenderer.invoke('schedule:findAllByWorkspace', workspaceId),
> ```
>
> 5. **Hook** (`src/renderer/src/entities/schedule/model/queries.ts`):
>
> ```typescript
> export function useAllSchedulesByWorkspace(
>   workspaceId: string | null | undefined
> ): UseQueryResult<ScheduleItem[]> {
>   return useQuery({
>     queryKey: [SCHEDULE_KEY, 'allByWorkspace', workspaceId],
>     queryFn: async (): Promise<ScheduleItem[]> => {
>       const res: IpcResponse<ScheduleItem[]> = await window.api.schedule.findAllByWorkspace(
>         workspaceId!
>       )
>       if (!res.success) throwIpcError(res)
>       return res.data ?? []
>     },
>     enabled: !!workspaceId
>   })
> }
> ```

---

## 11. Detail 페이지 통합

### 11.1 TodoDetailPage

**파일**: `src/renderer/src/pages/todo-detail/ui/TodoDetailPage.tsx`

`<SubTodoSection>` 아래에 추가:

```tsx
<div className="flex flex-col gap-6 py-4">
  <TodoDetailFields todo={todo} workspaceId={workspaceId} />
  <SubTodoSection ... />
  {/* 새로 추가 */}
  <LinkedEntitySection
    entityType="todo"
    entityId={todo.id}
    workspaceId={workspaceId}
  />
</div>
```

### 11.2 NotePage

**파일**: `src/renderer/src/pages/note/ui/NotePage.tsx`

NoteHeader와 NoteEditor 사이에 추가:

```tsx
<TabContainer header={<NoteHeader ... />}>
  {/* 새로 추가 */}
  <LinkedEntitySection
    entityType="note"
    entityId={noteId}
    workspaceId={workspaceId}
  />
  <NoteEditor ... />
</TabContainer>
```

### 11.3 PdfPage

**파일**: `src/renderer/src/pages/pdf/ui/PdfPage.tsx`

**레이아웃 제약**: PdfPage는 `scrollable={false}`이며 PdfViewer가 전체 영역을 차지한다.
inline으로 LinkedEntitySection을 추가하면 `overflow-hidden`에 의해 레이아웃이 깨진다.

**해결: PdfHeader에 `buttons` prop을 추가하여 TabHeader의 `buttons` slot에 전달**

**PdfHeader 수정** (`src/renderer/src/features/pdf/view-pdf/ui/PdfHeader.tsx`):

```typescript
interface PdfHeaderProps {
  workspaceId: string
  pdfId: string
  tabId?: string
  buttons?: React.JSX.Element  // 추가
}

export function PdfHeader({ workspaceId, pdfId, tabId, buttons }: PdfHeaderProps): JSX.Element {
  // ... 기존 로직 동일 ...
  return (
    <TabHeader
      editable
      icon={PdfIcon}
      iconColor="#ef4444"
      title={pdf?.title ?? ''}
      description={pdf?.description ?? ''}
      buttons={buttons}  // TabHeader의 buttons slot에 전달
      onTitleChange={...}
      onDescriptionChange={...}
    />
  )
}
```

**PdfPage 통합**:

```tsx
<TabContainer
  header={
    <PdfHeader
      workspaceId={workspaceId}
      pdfId={pdfId}
      tabId={tabId}
      buttons={
        <LinkedEntityPopoverButton
          entityType="pdf"
          entityId={pdfId}
          workspaceId={workspaceId}
        />
      }
    />
  }
  scrollable={false}
  maxWidth="full"
>
  <PdfViewer ... />
</TabContainer>
```

### 11.4 CsvPage

**파일**: `src/renderer/src/pages/csv/ui/CsvPage.tsx`

**동일한 레이아웃 제약** — PdfPage와 같은 Popover 방식 적용.

**CsvHeader 수정** (`src/renderer/src/features/csv/edit-csv/ui/CsvHeader.tsx`):

CsvHeader는 이미 `buttons`를 encoding badge에 사용 중. 외부에서 추가 버튼을 받을 수 있도록 `extraButtons` prop 추가:

```typescript
interface CsvHeaderProps {
  workspaceId: string
  csvId: string
  tabId?: string
  encoding?: string
  extraButtons?: React.JSX.Element  // 추가
}

export function CsvHeader({ workspaceId, csvId, tabId, encoding, extraButtons }: CsvHeaderProps): JSX.Element {
  // ... 기존 로직 동일 ...
  return (
    <TabHeader
      editable
      icon={Sheet}
      iconColor="#10b981"
      title={csv?.title ?? ''}
      description={csv?.description ?? ''}
      buttons={
        <div className="flex items-center gap-2">
          {extraButtons}
          {encoding && (
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
              {encoding}
            </span>
          )}
        </div>
      }
      onTitleChange={...}
      onDescriptionChange={...}
    />
  )
}
```

**CsvPage 통합**:

```tsx
<TabContainer
  header={
    <CsvHeader
      workspaceId={workspaceId}
      csvId={csvId}
      tabId={tabId}
      encoding={encoding}
      extraButtons={
        <LinkedEntityPopoverButton
          entityType="csv"
          entityId={csvId}
          workspaceId={workspaceId}
        />
      }
    />
  }
  scrollable={false}
  maxWidth="full"
>
  <CsvViewer ... />
</TabContainer>
```

### 11.3.1 LinkedEntityPopoverButton (PDF/CSV 전용)

**파일**: `src/renderer/src/features/entity-link/ui/LinkedEntityPopoverButton.tsx`

`scrollable={false}` 페이지에서 사용하는 대안 컴포넌트.
헤더에 배치되는 아이콘 버튼 + Popover로 링크 목록과 추가/삭제를 모두 처리.

```
┌──────────────────────────────────────┐
│ [🔗 3]  ← 링크 아이콘 + 카운트 버튼   │
└──────────────────────────────────────┘
         ↓ 클릭 시 Popover
┌──────────────────────────────────────┐
│ 연결된 항목                       [+] │
├──────────────────────────────────────┤
│  📝 노트 제목                    [×]  │
│  ✓  할 일 제목                   [×]  │
│  📊 테이블 제목                  [×]  │
├──────────────────────────────────────┤
│ + 항목 연결하기                       │
└──────────────────────────────────────┘
```

**Props**: `entityType`, `entityId`, `workspaceId` (LinkedEntitySectionProps와 동일)

### 11.5 Schedule (캘린더)

Schedule은 별도 상세 페이지가 없고 `ScheduleFormDialog`가 수정 UI.
ScheduleFormDialog 폼 하단에 추가:

```tsx
{
  /* 기존 폼 필드들 아래 */
}
{
  initialData && (
    <LinkedEntitySection
      entityType="schedule"
      entityId={initialData.id}
      workspaceId={workspaceId}
    />
  )
}
```

**주의**: `initialData`가 있을 때만 (수정 모드) 링크 섹션 표시. 생성 모드에서는 아직 ID가 없으므로 Phase 4에서 별도 처리.

---

## 12. Create 다이얼로그 통합

### 12.1 접근 방식

Create 시에는 아직 엔티티 ID가 없으므로 **임시 링크 상태**를 로컬에서 관리하고, 생성 후 일괄 링크.

```typescript
// 다이얼로그 내부 상태
const [pendingLinks, setPendingLinks] = useState<
  { entityType: LinkableEntityType; entityId: string; title: string }[]
>([])

// 생성 성공 후 — Promise.allSettled로 일괄 처리 (일부 실패해도 나머지 진행)
onSuccess: async (created) => {
  if (pendingLinks.length === 0) return

  await Promise.allSettled(
    pendingLinks.map((link) =>
      window.api.entityLink.link('todo', created.id, link.entityType, link.entityId, workspaceId)
    )
  )

  // 링크 목록 갱신
  queryClient.invalidateQueries({ queryKey: [ENTITY_LINK_KEY] })
  setPendingLinks([])
}
```

**설계 근거**: `Promise.allSettled` 사용으로:

1. 개별 링크 실패가 전체를 중단시키지 않음
2. mutate() 대신 직접 IPC 호출하여 순차적 mutation 대기 불필요
3. 모든 링크 처리 후 한번만 invalidate (불필요한 re-render 방지)

### 12.2 CreateTodoDialog

**파일**: `src/renderer/src/features/todo/create-todo/ui/CreateTodoDialog.tsx`

- `parentId`가 없을 때만 (최상위 todo) 링크 선택 UI 표시
- subtodo에는 링크 불필요
- 폼 하단에 `LinkEntityPopover` + 선택된 항목 칩 표시

### 12.3 ScheduleFormDialog

**파일**: `src/renderer/src/features/schedule/manage-schedule/ui/ScheduleFormDialog.tsx`

- 생성 모드(`!initialData`): pendingLinks 패턴 사용
- 수정 모드(`initialData`): 11.5의 LinkedEntitySection 사용

---

## 13. 구현 순서

| 순서 | 항목                        | 파일                                                      | 의존성 |
| ---- | --------------------------- | --------------------------------------------------------- | ------ |
| 1    | DB 스키마                   | `schema/entity-link.ts`, `schema/index.ts`                | 없음   |
| 2    | 마이그레이션                | `npm run db:generate && db:migrate`                       | 1      |
| 3    | Repository                  | `repositories/entity-link.ts`                             | 2      |
| 4    | todoRepository 추가         | `findAllDescendantIds` (BFS)                              | 3      |
| 5    | scheduleRepository 추가     | `findAllByWorkspaceId` (range 없는 전체 조회)             | 없음   |
| 6    | Service                     | `services/entity-link.ts`                                 | 3      |
| 7    | scheduleService 추가        | `findAllByWorkspace`                                      | 5      |
| 8    | 기존 서비스 수정            | todo/schedule/note/pdf/csv services                       | 4, 6   |
| 9    | 파일 워처 수정              | `workspace-watcher.ts` (line 402, 488, 574)               | 3      |
| 10   | IPC 핸들러                  | `ipc/entity-link.ts` + `schedule:findAllByWorkspace` 추가 | 6, 7   |
| 11   | Preload bridge              | `preload/index.ts` + `index.d.ts`                         | 10     |
| 12   | Shared 타입/유틸            | `shared/lib/entity-link.ts` (타입 + openTab + 아이콘)     | 11     |
| 13   | Entity hooks                | `entities/entity-link/` + `useAllSchedulesByWorkspace`    | 12     |
| 14   | LinkedEntityItem            | `features/entity-link/ui/`                                | 12, 13 |
| 15   | LinkEntityPopover           | `features/entity-link/ui/`                                | 13     |
| 16   | LinkedEntitySection         | `features/entity-link/ui/`                                | 14, 15 |
| 17   | LinkedEntityPopoverButton   | `features/entity-link/ui/` (PDF/CSV용)                    | 14, 15 |
| 18   | PdfHeader 수정              | `buttons` prop 추가                                       | 없음   |
| 19   | CsvHeader 수정              | `extraButtons` prop 추가                                  | 없음   |
| 20   | TodoDetail 통합             | `pages/todo-detail/`                                      | 16     |
| 21   | NotePage 통합               | `pages/note/`                                             | 16     |
| 22   | PdfPage 통합                | `pages/pdf/` (PopoverButton 방식)                         | 17, 18 |
| 23   | CsvPage 통합                | `pages/csv/` (PopoverButton 방식)                         | 17, 19 |
| 24   | Schedule 통합               | `ScheduleFormDialog`                                      | 16     |
| 25   | CreateTodoDialog 통합       | `features/todo/create-todo/`                              | 15     |
| 26   | ScheduleFormDialog 생성모드 | `features/schedule/`                                      | 15     |

---

## 14. 예외 케이스 처리 요약

| EC                        | 처리 위치                   | 구현 방법                                      |
| ------------------------- | --------------------------- | ---------------------------------------------- |
| EC-01 자기 링크           | Service `link()`            | type+id 비교 → ValidationError                 |
| EC-02 미존재 엔티티       | Service `link()`            | findEntity 호출 → NotFoundError                |
| EC-03 크로스 워크스페이스 | Service `link()`            | workspaceId 비교 → ValidationError             |
| EC-04 삭제 시 정리        | 각 Service `remove()`       | `removeAllLinks()` 호출 추가                   |
| EC-05 외부 파일 삭제      | 파일 워처                   | 삭제 감지 시 `removeAllLinks()` 호출           |
| EC-06 중복 링크           | Repository `link()`         | `onConflictDoNothing()`                        |
| EC-07 미존재 링크 삭제    | Repository `unlink()`       | DELETE 0 rows, 에러 없음                       |
| EC-08 openTab 매핑        | `shared/lib/entity-link.ts` | `getLinkTabOptions()` — 타입별 TabOptions 반환 |
| EC-09 고아 링크 정리      | Service `getLinked()`       | 조회 시 미존재 엔티티 필터 + 삭제              |
| EC-10 subtodo cascade     | Service (todo)              | `findAllDescendantIds` + 일괄 정리             |
| Workspace cascade         | DB FK                       | `workspaceId` ON DELETE CASCADE                |

---

## 15. schedule_todos 비침범 확인

| 항목                             | 변경 여부 | 설명                                                |
| -------------------------------- | --------- | --------------------------------------------------- |
| `schedule_todos` 스키마          | 변경 없음 |                                                     |
| `scheduleTodoRepository`         | 변경 없음 |                                                     |
| `scheduleService.linkTodo`       | 변경 없음 |                                                     |
| `scheduleService.unlinkTodo`     | 변경 없음 |                                                     |
| `scheduleService.getLinkedTodos` | 변경 없음 |                                                     |
| `schedule:linkTodo` IPC          | 변경 없음 |                                                     |
| `useLinkedTodos` hook            | 변경 없음 |                                                     |
| `LinkedTodoList` 컴포넌트        | 변경 없음 |                                                     |
| `TodoLinkPopover` 컴포넌트       | 변경 없음 |                                                     |
| `scheduleService.remove`         | **수정**  | entity_links 정리 호출 추가 (schedule_todos와 무관) |

---

## 16. 설계 검증 결과 (Design Review)

### 점검 완료 항목

| 카테고리                       | 결과      | 수정 사항                                                                                                           |
| ------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------- |
| **FSD 아키텍처**               | 수정 완료 | shared → entities 역방향 import 위반 발견 → 타입/유틸을 `shared/lib/entity-link.ts`로 이동                          |
| **PDF/CSV 레이아웃**           | 수정 완료 | `scrollable={false}` 페이지에 inline 섹션 불가 → `LinkedEntityPopoverButton` 대안 설계                              |
| **Hook 이름 정합성**           | 수정 완료 | `usePdfFilesByWorkspace`, `useCsvFilesByWorkspace` (File 접미사)                                                    |
| **재귀 안전성**                | 수정 완료 | `findAllDescendantIds` 재귀 → BFS 반복 방식으로 변경                                                                |
| **고아 링크 정리**             | 수정 완료 | "비동기" → "동기" 코멘트 수정                                                                                       |
| **pendingLinks 안전성**        | 수정 완료 | `Promise.allSettled` 패턴으로 일부 실패 허용                                                                        |
| **로딩/빈 상태**               | 수정 완료 | LinkedEntitySection 상태별 UI 명세 추가                                                                             |
| **순환 의존성**                | 이상 없음 | entityLinkService → repositories만, 역방향 없음                                                                     |
| **React Query 무효화**         | 이상 없음 | 양방향 invalidate 패턴 적절                                                                                         |
| **Workspace cascade**          | 이상 없음 | workspaceId FK ON DELETE CASCADE 확인                                                                               |
| **schedule_todos 비침범**      | 이상 없음 | remove()에 1줄 추가만, 기존 API/hook/UI 변경 없음                                                                   |
| **IPC 등록 패턴**              | 이상 없음 | `registerEntityLinkHandlers()` 기존 패턴 준수                                                                       |
| **Preload bridge**             | 이상 없음 | 기존 구조 그대로 확장                                                                                               |
| **PdfHeader/CsvHeader 통합**   | 수정 완료 | PdfHeader가 children/buttons 미지원 → `buttons` prop 추가 설계. CsvHeader는 `extraButtons` prop 추가                |
| **Schedule 전체 조회**         | 수정 완료 | `useSchedulesByWorkspace`는 range 필수 → `findAllByWorkspaceId` + `useAllSchedulesByWorkspace` 신규 파이프라인 추가 |
| **파일 워처 링크 정리**        | 수정 완료 | workspace-watcher.ts line 402/488/574에 `entityLinkRepository.removeAllByEntity()` 호출 명시                        |
| **getWorkspaceId null 안전성** | 수정 완료 | `schedules.workspaceId` nullable → null 체크 + ValidationError                                                      |
| **throwIpcError 패턴**         | 수정 완료 | React Query hooks에서 `throwIpcError(res)` + `IpcResponse` 타입 사용                                                |
| **createdAt 컬럼 타입**        | 수정 완료 | `text` → `integer(timestamp_ms)` (기존 전체 스키마 패턴 준수)                                                       |
| **linkedAt 타입**              | 수정 완료 | `string` → `Date` (timestamp_ms → Date 매핑)                                                                        |
| **IPC 핸들러 타입**            | 수정 완료 | `_: IpcMainInvokeEvent`, `: IpcResponse` 반환 타입, import 추가                                                     |
| **미사용 nanoid import**       | 수정 완료 | entity_links는 composite PK 사용, nanoid 불필요 → import 제거                                                       |
| **EC-08 파일 참조**            | 수정 완료 | `link-tab-config.ts` → `shared/lib/entity-link.ts`                                                                  |
| **FSD 레이아웃 목록**          | 수정 완료 | `LinkedEntityPopoverButton.tsx` 누락 → 추가                                                                         |

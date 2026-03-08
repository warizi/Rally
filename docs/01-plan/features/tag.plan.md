# Tag Plan

> **Feature**: tag
> **Date**: 2026-03-05
> **Status**: Draft

---

## 1. Overview

Rally의 각 기능(note, todo, image, canvas, pdf, csv, folder 등)에 Tag를 부여해 카테고리 분류를 한다.

### 1.1 목표

- 기존 도메인 schema에 영향 없이 `tags` / `item_tags` 테이블을 별도로 추가
- 각 엔티티와 다대다(N:N) 관계로 연결
- 각 기능 list에서 tagId 기반 query filter 지원

### 1.2 적용 범위

| 영역     | 범위                                                   |
| -------- | ------------------------------------------------------ |
| DB       | `tags`, `item_tags` 테이블 신규 생성                   |
| Backend  | tag CRUD + item_tag 연결/해제 repository, service, IPC |
| Frontend | 공통 UI 컴포넌트 + 각 기능별 상세 화면 통합            |

---

## 2. DB Schema

### 2.1 tags 테이블

| 컬럼        | 타입                   | nullable | 비고                                  |
| ----------- | ---------------------- | -------- | ------------------------------------- |
| id          | text (nanoid)          | false    | PK                                    |
| workspaceId | text                   | false    | FK → workspaces.id, on delete cascade |
| name        | text                   | false    | 태그 이름                             |
| color       | text                   | false    | 태그 색상                             |
| description | text                   | true     | 설명                                  |
| createdAt   | integer (timestamp_ms) | false    |                                       |

### 2.2 item_tags 테이블

| 컬럼      | 타입                   | nullable | 비고                                              |
| --------- | ---------------------- | -------- | ------------------------------------------------- |
| id        | text (nanoid)          | false    | PK                                                |
| itemType  | text (enum)            | false    | note / todo / image / pdf / csv / canvas / folder |
| tagId     | text                   | false    | FK → tags.id, on delete cascade                   |
| itemId    | text                   | false    | 로직으로 on delete 처리                           |
| createdAt | integer (timestamp_ms) | false    |                                                   |

**인덱스:**

- `idx_item_tags_item` → `(itemType, itemId)` — 아이템별 태그 조회 성능
- `idx_item_tags_tag` → `(tagId)` — 태그별 아이템 조회 성능

**Unique 제약:**

- `unique(itemType, tagId, itemId)` — 동일 아이템에 같은 태그 중복 할당 방지

### 2.3 itemType enum 값

`note` | `todo` | `image` | `pdf` | `csv` | `canvas` | `folder`

(entity-link의 `LinkableEntityType`과 유사하나 schedule 제외, folder 추가)

---

## 3. Backend 구현

### 3.1 Repository

**repositories/tag.ts**

- 타입: `Tag = typeof tags.$inferSelect`, `TagInsert = typeof tags.$inferInsert`
- `findByWorkspaceId(workspaceId)` → `Tag[]`
- `findById(id)` → `Tag | undefined`
- `create(data: TagInsert)` → `Tag` (`.returning().get()`)
- `update(id, data: Partial<Pick<Tag, 'name' | 'color' | 'description'>>)` → `Tag | undefined`
- `delete(id)` → `void` (`.run()`, item_tags cascade)

**repositories/item-tag.ts**

- 타입: `ItemTag = typeof itemTags.$inferSelect`, `ItemTagInsert = typeof itemTags.$inferInsert`
- `findByItem(itemType, itemId)` → `ItemTag[]`
- `findByTag(tagId)` → `ItemTag[]`
- `attach(data: ItemTagInsert)` → `void` (`.onConflictDoNothing().run()`, idempotent)
- `detach(itemType, tagId, itemId)` → `void`
- `detachAllByItem(itemType, itemId)` → `void`
- `detachAllByTag(tagId)` → `void`

### 3.2 Service

**services/tag.ts**

- 도메인 DTO: `TagItem` 인터페이스 (timestamp → Date 변환)
- private `toTagItem()` 매퍼 (Date | number 다형성 처리)
- `getAll(workspaceId)` → `TagItem[]`
- `create(workspaceId, input)` → `TagItem` (nanoid, 중복 이름 검사)
- `update(id, input)` → `TagItem`
- `remove(id)` → `void`

**services/item-tag.ts**

- 도메인 DTO: `ItemTagLink` 인터페이스
- private `toItemTagLink()` 매퍼
- `getTagsByItem(itemType, itemId)` → `TagItem[]` (join 조회)
- `attach(itemType, tagId, itemId)` → `void` (중복 방지 — onConflictDoNothing)
- `detach(itemType, tagId, itemId)` → `void`
- `removeByItem(itemType, itemId)` → `void` (아이템 삭제 시 정리)

### 3.3 IPC Handlers

**ipc/tag.ts** — `registerTagHandlers()`

- `tag:getAll` → `handle(() => tagService.getAll(workspaceId))`
- `tag:create` → `handle(() => tagService.create(workspaceId, input))`
- `tag:update` → `handle(() => tagService.update(id, input))`
- `tag:remove` → `handle(() => tagService.remove(id))`

**ipc/item-tag.ts** — `registerItemTagHandlers()`

- `itemTag:getByItem` → `handle(() => itemTagService.getTagsByItem(itemType, itemId))`
- `itemTag:attach` → `handle(() => itemTagService.attach(itemType, tagId, itemId))`
- `itemTag:detach` → `handle(() => itemTagService.detach(itemType, tagId, itemId))`

**등록**: `src/main/index.ts`에 `registerTagHandlers()`, `registerItemTagHandlers()` 호출 추가

### 3.4 Preload Bridge

**preload/index.ts** — `api` 객체에 namespace 추가:

```typescript
tag: {
  getAll: (workspaceId) => ipcRenderer.invoke('tag:getAll', workspaceId),
  create: (workspaceId, input) => ipcRenderer.invoke('tag:create', workspaceId, input),
  update: (id, input) => ipcRenderer.invoke('tag:update', id, input),
  remove: (id) => ipcRenderer.invoke('tag:remove', id),
},
itemTag: {
  getByItem: (itemType, itemId) => ipcRenderer.invoke('itemTag:getByItem', itemType, itemId),
  attach: (itemType, tagId, itemId) => ipcRenderer.invoke('itemTag:attach', itemType, tagId, itemId),
  detach: (itemType, tagId, itemId) => ipcRenderer.invoke('itemTag:detach', itemType, tagId, itemId),
}
```

**preload/index.d.ts** — 타입 정의:

```typescript
interface TagAPI {
  getAll: (workspaceId: string) => Promise<IpcResponse<TagItem[]>>
  create: (workspaceId: string, input: CreateTagInput) => Promise<IpcResponse<TagItem>>
  update: (id: string, input: UpdateTagInput) => Promise<IpcResponse<TagItem>>
  remove: (id: string) => Promise<IpcResponse<void>>
}

interface ItemTagAPI {
  getByItem: (itemType: TaggableEntityType, itemId: string) => Promise<IpcResponse<TagItem[]>>
  attach: (
    itemType: TaggableEntityType,
    tagId: string,
    itemId: string
  ) => Promise<IpcResponse<void>>
  detach: (
    itemType: TaggableEntityType,
    tagId: string,
    itemId: string
  ) => Promise<IpcResponse<void>>
}

// API 인터페이스에 추가
interface API {
  // ...기존 항목
  tag: TagAPI
  itemTag: ItemTagAPI
}
```

### 3.5 기존 서비스 연동

각 엔티티의 `remove` 메서드에서 `itemTagService.removeByItem()` 호출 추가 (entityLinkService.removeAllLinks 호출 직후):

- note.service.ts → remove
- todo.service.ts → remove
- image-file.service.ts → remove
- pdf-file.service.ts → remove
- csv-file.service.ts → remove
- canvas.service.ts → remove
- folder.service.ts → remove

---

## 4. Frontend 구현

### 4.1 FSD 레이어 배치

**entities/tag/** — 도메인 모델 + React Query

```
entities/tag/
├── model/
│   ├── types.ts          ← TagItem, TaggableEntityType 인터페이스
│   └── queries.ts        ← useTagsByWorkspace, useCreateTag, useUpdateTag, useRemoveTag,
│                            useTagsByItem, useAttachTag, useDetachTag
├── ui/
│   └── TagBadge.tsx      ← 개별 태그 표시 (color dot + name)
└── index.ts              ← barrel export
```

**features/tag/manage-tag/** — 태그 관리 UI

```
features/tag/
└── manage-tag/
    └── ui/
        ├── TagList.tsx           ← 태그 목록 (direction: row | column, + 버튼)
        ├── TagCreateDialog.tsx   ← 태그 생성 (name, color, description)
        ├── TagUpdateDialog.tsx   ← 태그 수정
        └── TagPicker.tsx         ← 아이템에 태그 할당/해제 팝오버
```

### 4.2 공통 UI 컴포넌트

**TagBadge** (`entities/tag/ui/`) — 개별 태그 표시 (color dot + name)

**TagList** (`features/tag/manage-tag/ui/`) — 태그 목록 컴포넌트

- `direction` prop: `row` | `column` (기본값: `row`)
- `row`: 가로 스크롤, 우측에 + 버튼 고정
- `column`: 세로 스크롤, 하단에 + 버튼 고정
- width full, overflow scroll

**TagCreateDialog** — zod + react-hook-form 패턴 (name, color, description)
**TagUpdateDialog** — 동일 패턴, defaultValues로 기존 값 세팅

### 4.3 각 기능별 UI 추가 위치

| 기능        | 추가 위치                                | 비고                          |
| ----------- | ---------------------------------------- | ----------------------------- |
| Note        | NotePage (note detail)                   | TabHeader 영역 하단에 TagList |
| Folder      | FolderNameDialog (create/rename 공용)    | 기존 dialog에 TagList 삽입    |
| Folder      | FolderColorDialog 영역 또는 context menu | 색상과 함께 태그 관리         |
| Todo        | CreateTodoDialog                         | form fields에 TagPicker 추가  |
| Todo        | TodoDetailPage (todo detail)             | TabHeader 영역 하단에 TagList |
| Image       | ImagePage (image detail)                 | TabHeader 영역 하단에 TagList |
| PDF         | PdfPage (pdf detail)                     | TabHeader 영역 하단에 TagList |
| Canvas      | CanvasDetailPage (canvas detail)         | TabHeader 영역 하단에 TagList |
| Table (CSV) | CsvPage (table detail)                   | TabHeader 영역 하단에 TagList |

### 4.4 List Filter

기존 todo filter 패턴(`tabSearchParams`)을 따라 태그 필터 구현:

- `navigateTab(tabId, { searchParams: { tagId: selectedTagId } })` — 탭 전환 시 필터 유지
- 각 list 상단에 태그 필터 UI (워크스페이스 태그 목록에서 선택)
- 선택한 태그의 item_tags를 기반으로 해당 itemType의 itemId 목록 필터링

### 4.5 React Query 키

```typescript
const TAG_KEY = 'tag'
const ITEM_TAG_KEY = 'itemTag'[
  // queryKey
  (TAG_KEY, 'workspace', workspaceId)
][(ITEM_TAG_KEY, itemType, itemId)] // 워크스페이스별 태그 목록 // 아이템별 태그

// mutation onSuccess invalidate
queryClient.invalidateQueries({ queryKey: [TAG_KEY, 'workspace', workspaceId] })
queryClient.invalidateQueries({ queryKey: [ITEM_TAG_KEY, itemType, itemId] })
```

---

## 5. 구현 순서

1. **DB Schema** — `tags`, `item_tags` 테이블 생성 + migration
2. **Repository** — repositories/tag.ts, repositories/item-tag.ts
3. **Service + 기존 연동** — services/tag.ts, services/item-tag.ts + 각 엔티티 remove에 cleanup 추가
4. **IPC + Preload** — ipc/tag.ts, ipc/item-tag.ts + preload bridge + main/index.ts 등록
5. **entities/tag** — types, queries, TagBadge
6. **features/tag** — TagList, TagCreateDialog, TagUpdateDialog, TagPicker
7. **각 기능 통합** — detail 화면에 TagList 추가
8. **List Filter** — 태그 기반 필터링

---

## 6. 참고 사항

- `entity-link` 패턴을 참고하되, tag는 workspace 단위로 관리
- itemId의 FK 제약은 걸지 않음 (다양한 테이블 참조이므로 로직으로 처리)
- tag 삭제 시 item_tags는 DB cascade로 자동 정리
- item 삭제 시 item_tags는 service 로직으로 정리
- tag 자체는 `LinkableEntityType`에 포함하지 않음 (entity-link 대상이 아님)
- repository 파일명은 프로젝트 컨벤션에 맞춰 `.repository` 접미사 없이 사용

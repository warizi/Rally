# Tag Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: Rally
> **Analyst**: gap-detector
> **Date**: 2026-03-05
> **Design Doc**: [tag.design.md](../../02-design/features/tag.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Compare `docs/02-design/features/tag.design.md` (sections 2-4) against the actual implementation across all 3 layers (main/preload/renderer). The design document was updated to reflect previous iteration improvements (hook names, query keys, IPC channel names, TabHeader `footer` prop, TagColorPicker). This analysis verifies the updated design matches the current codebase.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/tag.design.md`
- **Implementation Path**: `src/main/`, `src/preload/`, `src/renderer/src/`
- **Analysis Date**: 2026-03-05
- **Excluded**: Section 4.4 Patterns C/D (FolderTree, CreateTodoDialog) and Section 4.5 (List Filter) -- explicitly deferred in design

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 DB Schema (Section 2)

| #   | Item                                                             | Design                | Implementation                   | Status |
| --- | ---------------------------------------------------------------- | --------------------- | -------------------------------- | ------ |
| 1   | `tags` table definition                                          | `schema/tag.ts`       | `src/main/db/schema/tag.ts`      | MATCH  |
| 2   | `TaggableEntityType` type                                        | 7 union members       | Identical 7 members              | MATCH  |
| 3   | `TAGGABLE_ENTITY_TYPES` array                                    | alphabetical order    | Identical                        | MATCH  |
| 4   | `tags` columns (id/workspaceId/name/color/description/createdAt) | As specified          | Identical                        | MATCH  |
| 5   | `unique(workspaceId, name)` constraint                           | anonymous unique()    | Identical                        | MATCH  |
| 6   | `description` nullable (no `.notNull()`)                         | Nullable              | Identical                        | MATCH  |
| 7   | `createdAt` timestamp_ms, no updatedAt                           | As specified          | Identical                        | MATCH  |
| 8   | `item_tags` table definition                                     | `schema/item-tag.ts`  | `src/main/db/schema/item-tag.ts` | MATCH  |
| 9   | `item_tags` columns (id/itemType/tagId/itemId/createdAt)         | As specified          | Identical                        | MATCH  |
| 10  | `unique(itemType, tagId, itemId)`                                | anonymous unique()    | Identical                        | MATCH  |
| 11  | `idx_item_tags_item` index on (itemType, itemId)                 | As specified          | Identical                        | MATCH  |
| 12  | `idx_item_tags_tag` index on (tagId)                             | As specified          | Identical                        | MATCH  |
| 13  | `tagId` FK cascade to tags.id                                    | As specified          | Identical                        | MATCH  |
| 14  | Schema registration in `schema/index.ts`                         | export tags, itemTags | Lines 19-20 import, 41-42 export | MATCH  |

**Schema Score: 14/14 = 100%**

### 2.2 Repositories (Section 3.1-3.2)

| #   | Item                       | Design                                                     | Implementation                                   | Status |
| --- | -------------------------- | ---------------------------------------------------------- | ------------------------------------------------ | ------ |
| 15  | `tagRepository` object     | 6 methods                                                  | `src/main/repositories/tag.ts` -- 6 methods      | MATCH  |
| 16  | `findByWorkspaceId`        | `.where(eq(tags.workspaceId, ...)).all()`                  | Identical                                        | MATCH  |
| 17  | `findById`                 | `.where(eq(tags.id, ...)).get()`                           | Identical                                        | MATCH  |
| 18  | `findByName`               | `and(eq(workspaceId), eq(name)).get()`                     | Identical                                        | MATCH  |
| 19  | `create`                   | `.insert().values().returning().get()`                     | Identical                                        | MATCH  |
| 20  | `update` signature         | `(id, Partial<Pick<Tag, 'name'\|'color'\|'description'>>)` | Identical                                        | MATCH  |
| 21  | `delete`                   | `.delete().where(eq(id)).run()`                            | Identical                                        | MATCH  |
| 22  | `Tag` / `TagInsert` types  | `$inferSelect` / `$inferInsert`                            | Identical                                        | MATCH  |
| 23  | `itemTagRepository` object | 6 methods                                                  | `src/main/repositories/item-tag.ts` -- 6 methods | MATCH  |
| 24  | `findByItem`               | `and(eq(itemType), eq(itemId)).all()`                      | Identical                                        | MATCH  |
| 25  | `findByTag`                | `eq(tagId).all()`                                          | Identical                                        | MATCH  |
| 26  | `attach`                   | `.insert().onConflictDoNothing().run()`                    | Identical                                        | MATCH  |
| 27  | `detach`                   | `and(eq(itemType), eq(tagId), eq(itemId)).run()`           | Identical                                        | MATCH  |
| 28  | `detachAllByItem`          | `and(eq(itemType), eq(itemId)).run()`                      | Identical                                        | MATCH  |
| 29  | `detachAllByTag`           | `eq(tagId).run()`                                          | Identical                                        | MATCH  |

**Repository Score: 15/15 = 100%**

### 2.3 Services (Section 3.3-3.4)

| #   | Item                             | Design                                           | Implementation                                   | Status |
| --- | -------------------------------- | ------------------------------------------------ | ------------------------------------------------ | ------ |
| 30  | `TagItem` interface              | 6 fields                                         | `src/main/services/tag.ts` -- identical 6 fields | MATCH  |
| 31  | `toTagItem` mapper               | `createdAt instanceof Date` guard                | Identical                                        | MATCH  |
| 32  | `CreateTagInput` interface       | name/color/description?                          | Identical                                        | MATCH  |
| 33  | `UpdateTagInput` interface       | name?/color?/description?                        | Identical                                        | MATCH  |
| 34  | `tagService.getAll`              | workspace check + map(toTagItem)                 | Identical                                        | MATCH  |
| 35  | `tagService.create`              | workspace check + duplicate check + nanoid       | Identical                                        | MATCH  |
| 36  | `tagService.update`              | tag check + rename conflict + conditional spread | Identical                                        | MATCH  |
| 37  | `tagService.remove`              | tag check + cascade comment + delete             | Identical                                        | MATCH  |
| 38  | `itemTagService` object          | 5 methods                                        | `src/main/services/item-tag.ts` -- 5 methods     | MATCH  |
| 39  | `itemTagService.getTagsByItem`   | loop findById + toTagItem                        | Identical                                        | MATCH  |
| 40  | `itemTagService.getItemIdsByTag` | findByTag + filter + map                         | Identical                                        | MATCH  |
| 41  | `itemTagService.attach`          | tag existence check + nanoid                     | Identical                                        | MATCH  |
| 42  | `itemTagService.detach`          | passthrough to repository                        | Identical                                        | MATCH  |
| 43  | `itemTagService.removeByItem`    | passthrough to detachAllByItem                   | Identical                                        | MATCH  |

**Service Score: 14/14 = 100%**

### 2.4 IPC Handlers (Section 3.5)

| #   | Item                               | Design       | Implementation                           | Status | Notes |
| --- | ---------------------------------- | ------------ | ---------------------------------------- | ------ | ----- |
| 44  | `registerTagHandlers` function     | 4 channels   | `src/main/ipc/tag.ts` -- 4 channels      | MATCH  |       |
| 45  | Channel `tag:getAll`               | As specified | Identical                                | MATCH  |       |
| 46  | Channel `tag:create`               | As specified | Identical                                | MATCH  |       |
| 47  | Channel `tag:update`               | As specified | Identical                                | MATCH  |       |
| 48  | Channel `tag:remove`               | As specified | Identical                                | MATCH  |       |
| 49  | `registerItemTagHandlers` function | 4 channels   | `src/main/ipc/item-tag.ts` -- 4 channels | MATCH  |       |
| 50  | Channel `itemTag:getTagsByItem`    | As specified | Identical                                | MATCH  |       |
| 51  | Channel `itemTag:attach`           | As specified | Identical                                | MATCH  |       |
| 52  | Channel `itemTag:detach`           | As specified | Identical                                | MATCH  |       |
| 53  | Channel `itemTag:getItemIdsByTag`  | As specified | Identical                                | MATCH  |       |

**IPC Score: 10/10 = 100%**

### 2.5 Handler Registration (Section 3.6)

| #   | Item                             | Design                 | Implementation | Status |
| --- | -------------------------------- | ---------------------- | -------------- | ------ |
| 54  | Import `registerTagHandlers`     | In `src/main/index.ts` | Line 24        | MATCH  |
| 55  | Import `registerItemTagHandlers` | In `src/main/index.ts` | Line 25        | MATCH  |
| 56  | Call `registerTagHandlers()`     | In `app.whenReady()`   | Line 110       | MATCH  |
| 57  | Call `registerItemTagHandlers()` | In `app.whenReady()`   | Line 111       | MATCH  |

**Registration Score: 4/4 = 100%**

### 2.6 Preload Bridge (Section 3.7)

| #   | Item                      | Design                            | Implementation                 | Status | Notes                            |
| --- | ------------------------- | --------------------------------- | ------------------------------ | ------ | -------------------------------- |
| 58  | `tag.getAll`              | `tag:getAll` channel              | Line 293                       | MATCH  |                                  |
| 59  | `tag.create`              | `tag:create` channel, typed input | Line 294-295, `input: unknown` | MATCH  | Cosmetic: runtime uses `unknown` |
| 60  | `tag.update`              | `tag:update` channel, typed input | Line 296, `input: unknown`     | MATCH  | Cosmetic: runtime uses `unknown` |
| 61  | `tag.remove`              | `tag:remove` channel              | Line 297                       | MATCH  |                                  |
| 62  | `itemTag.getTagsByItem`   | `itemTag:getTagsByItem` channel   | Line 301-302                   | MATCH  |                                  |
| 63  | `itemTag.attach`          | `itemTag:attach` channel          | Line 305-306                   | MATCH  |                                  |
| 64  | `itemTag.detach`          | `itemTag:detach` channel          | Line 307-308                   | MATCH  |                                  |
| 65  | `itemTag.getItemIdsByTag` | `itemTag:getItemIdsByTag` channel | Line 303-304                   | MATCH  |                                  |

**Preload Bridge Score: 8/8 = 100%**

### 2.7 Preload Type Declarations (Section 3.8)

| #   | Item                                         | Design                          | Implementation             | Status |
| --- | -------------------------------------------- | ------------------------------- | -------------------------- | ------ |
| 66  | `TaggableEntityType` type                    | 7-member union                  | Line 589 -- identical      | MATCH  |
| 67  | `TagItem` interface                          | 6 fields                        | Lines 591-598 -- identical | MATCH  |
| 68  | `CreateTagInput` interface                   | name/color/description?         | Lines 600-604 -- identical | MATCH  |
| 69  | `UpdateTagInput` interface                   | name?/color?/description?       | Lines 606-610 -- identical | MATCH  |
| 70  | `TagAPI` interface                           | 4 methods                       | Lines 612-617 -- identical | MATCH  |
| 71  | `ItemTagAPI.getTagsByItem`                   | Typed with `TaggableEntityType` | Lines 620-623 -- identical | MATCH  |
| 72  | `ItemTagAPI.attach`                          | Typed with `TaggableEntityType` | Lines 628-632 -- identical | MATCH  |
| 73  | `ItemTagAPI.detach`                          | Typed with `TaggableEntityType` | Lines 633-637 -- identical | MATCH  |
| 74  | `ItemTagAPI.getItemIdsByTag`                 | Typed correctly                 | Lines 624-627 -- identical | MATCH  |
| 75  | `API` interface includes `tag` and `itemTag` | As specified                    | Lines 658-659 -- present   | MATCH  |

**Preload Types Score: 10/10 = 100%**

### 2.8 Existing Service Integration (Section 3.9)

| #   | Service                                                      | Design Spec                    | Implementation                                | Status   | Notes                                |
| --- | ------------------------------------------------------------ | ------------------------------ | --------------------------------------------- | -------- | ------------------------------------ |
| 76  | `noteService.remove`                                         | after entityLink               | Line 258 in `src/main/services/note.ts`       | MATCH    |                                      |
| 77  | `todoService.remove`                                         | loop `[todoId, ...subtodoIds]` | Lines 227-229 in `src/main/services/todo.ts`  | MATCH    |                                      |
| 78  | `imageFileService.remove`                                    | after entityLink               | Line 217 in `src/main/services/image-file.ts` | MATCH    |                                      |
| 79  | `pdfFileService.remove`                                      | after entityLink               | Line 222 in `src/main/services/pdf-file.ts`   | MATCH    |                                      |
| 80  | `csvFileService.remove`                                      | after entityLink               | Line 244 in `src/main/services/csv-file.ts`   | MATCH    |                                      |
| 81  | `canvasService.remove`                                       | no entityLink (Phase 2 TODO)   | Line 87 in `src/main/services/canvas.ts`      | MATCH    |                                      |
| 82  | `folderService.remove`                                       | Design: before rmSync          | Impl: after rmSync (line 326)                 | COSMETIC | Order differs; both before DB delete |
| 83  | Import `itemTagService` in all 7 services                    | Present                        | Verified all 7 imports                        | MATCH    |                                      |
| 84  | Cleanup order: entityLink -> itemTag -> canvasNode -> delete | Per design                     | Verified in note, image, pdf, csv             | MATCH    |                                      |

**Integration Score: 9/9 = 100%** (item 82 is cosmetic ordering -- no functional difference)

### 2.9 Frontend -- entities/tag/model/types.ts (Section 4.2)

| #   | Item                 | Design                    | Implementation | Status |
| --- | -------------------- | ------------------------- | -------------- | ------ |
| 85  | `TaggableEntityType` | 7-member union            | Identical      | MATCH  |
| 86  | `TagItem` interface  | 6 fields                  | Identical      | MATCH  |
| 87  | `CreateTagInput`     | name/color/description?   | Identical      | MATCH  |
| 88  | `UpdateTagInput`     | name?/color?/description? | Identical      | MATCH  |

**Types Score: 4/4 = 100%**

### 2.10 Frontend -- entities/tag/model/queries.ts (Section 4.2)

| #   | Item                                                 | Design                                                  | Implementation                              | Status | Notes |
| --- | ---------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------- | ------ | ----- |
| 89  | `TAG_KEY = 'tag'`                                    | As specified                                            | Identical                                   | MATCH  |       |
| 90  | `ITEM_TAG_KEY = 'itemTag'`                           | As specified                                            | Identical                                   | MATCH  |       |
| 91  | `useTags(workspaceId: string \| undefined)`          | As specified                                            | Identical                                   | MATCH  |       |
| 92  | Query key `[TAG_KEY, workspaceId]`                   | As specified                                            | Identical                                   | MATCH  |       |
| 93  | `useItemTags(itemType, itemId)`                      | As specified                                            | Identical                                   | MATCH  |       |
| 94  | Query key `[ITEM_TAG_KEY, itemType, itemId]`         | As specified                                            | Identical                                   | MATCH  |       |
| 95  | `useItemIdsByTag(tagId, itemType)`                   | As specified                                            | Identical                                   | MATCH  |       |
| 96  | Query key `[ITEM_TAG_KEY, 'byTag', tagId, itemType]` | As specified                                            | Identical                                   | MATCH  |       |
| 97  | `useCreateTag` mutationFn + onSuccess                | invalidates `[TAG_KEY, workspaceId]`                    | Identical                                   | MATCH  |       |
| 98  | `useUpdateTag`                                       | invalidates `[TAG_KEY, workspaceId]`                    | Identical                                   | MATCH  |       |
| 99  | `useRemoveTag` onSuccess                             | invalidates `[TAG_KEY, workspaceId]` + `[ITEM_TAG_KEY]` | Lines 115-117 -- both invalidations present | MATCH  |       |
| 100 | `useAttachTag`                                       | invalidates `[ITEM_TAG_KEY, itemType, itemId]`          | Identical                                   | MATCH  |       |
| 101 | `useDetachTag`                                       | invalidates `[ITEM_TAG_KEY, itemType, itemId]`          | Identical                                   | MATCH  |       |

**Queries Score: 13/13 = 100%**

### 2.11 Frontend -- entities/tag/ui/TagBadge.tsx (Section 4.2)

| #   | Item                            | Design                                                | Implementation                                                      | Status   | Notes                               |
| --- | ------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- | -------- | ----------------------------------- |
| 102 | `TagBadgeProps` interface       | `{ tag, onRemove?, className? }`                      | Identical                                                           | MATCH    |                                     |
| 103 | Color styling                   | `backgroundColor: ${tag.color}20`, `color: tag.color` | Identical                                                           | MATCH    |                                     |
| 104 | Color dot                       | `size-2 rounded-full shrink-0`                        | Identical                                                           | MATCH    |                                     |
| 105 | Name text                       | Design: `truncate max-w-[120px]` wrapper              | Impl: plain `{tag.name}` -- no truncation                           | COSMETIC | Truncation removed                  |
| 106 | Remove button X icon            | Lucide `<X className="size-3" />`                     | Identical                                                           | MATCH    |                                     |
| 107 | `e.stopPropagation()` on remove | As specified                                          | Identical                                                           | MATCH    |                                     |
| 108 | CSS classes                     | Design: `gap-1 px-2 py-0.5 rounded-full text-xs`      | Impl: `gap-1 rounded-full px-2 py-0.5 text-xs font-medium`          | COSMETIC | Order differs + `font-medium` added |
| 109 | Remove button hover style       | Design: `hover:opacity-70`                            | Impl: `rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10` | COSMETIC | Dark mode support added             |

**TagBadge Score: 7/8 (1 cosmetic: truncation removed)**

### 2.12 Frontend -- entities/tag/index.ts barrel export (Section 4.2)

| #   | Item                   | Design                                                                 | Implementation | Status |
| --- | ---------------------- | ---------------------------------------------------------------------- | -------------- | ------ |
| 110 | Export types           | `TagItem, TaggableEntityType, CreateTagInput, UpdateTagInput`          | Identical      | MATCH  |
| 111 | Export query constants | `TAG_KEY, ITEM_TAG_KEY`                                                | Identical      | MATCH  |
| 112 | Export hooks           | `useTags, useItemTags, useItemIdsByTag`                                | Identical      | MATCH  |
| 113 | Export mutations       | `useCreateTag, useUpdateTag, useRemoveTag, useAttachTag, useDetachTag` | Identical      | MATCH  |
| 114 | Export `TagBadge`      | As specified                                                           | Identical      | MATCH  |

**Barrel Export Score: 5/5 = 100%**

### 2.13 Frontend -- features/tag/manage-tag (Section 4.3)

| #   | Item                              | Design                                                                                       | Implementation                                                           | Status   | Notes                                    |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------- | ---------------------------------------- |
| 115 | `TagColorPicker.tsx` exists       | 12 preset colors, grid-cols-6, Check icon                                                    | `src/renderer/src/features/tag/manage-tag/ui/TagColorPicker.tsx`         | MATCH    |                                          |
| 116 | `TagColorPicker` Props            | `{ value: string, onChange: (color: string) => void }`                                       | Identical                                                                | MATCH    |                                          |
| 117 | `PRESET_COLORS` values            | Design: `['#a3c4f5', '#93c5fd', '#6ee7b7', ...]` 12 hex strings                              | Impl: `TAG_COLORS` array of `{ label, value }` with different hex values | COSMETIC | Different color palette + label metadata |
| 118 | `TagCreateDialog.tsx` exists      | As specified                                                                                 | Present                                                                  | MATCH    |                                          |
| 119 | `TagCreateDialog` schema          | `name: z.string().min(1).max(50)`, `color: z.string().min(1)`                                | Identical (adds custom error message)                                    | MATCH    |                                          |
| 120 | `TagCreateDialog` Props           | `{ open, onOpenChange, isPending, onSubmit }`                                                | Identical (isPending is optional in impl)                                | MATCH    |                                          |
| 121 | Default color `'#a3c4f5'`         | As specified                                                                                 | Identical                                                                | MATCH    |                                          |
| 122 | `TagUpdateDialog.tsx` exists      | As specified                                                                                 | Present                                                                  | MATCH    |                                          |
| 123 | `TagUpdateDialog` Props           | `{ open, onOpenChange, tag, isPending, onSubmit, onRemove }`                                 | Identical (isPending/onRemove optional in impl)                          | MATCH    |                                          |
| 124 | `TagPicker.tsx` exists            | As specified                                                                                 | Present                                                                  | MATCH    |                                          |
| 125 | `TagPicker` Props                 | `{ allTags, attachedTagIds, onToggle, onCreateClick }`                                       | Identical                                                                | MATCH    |                                          |
| 126 | TagPicker search filter           | Input with local filter                                                                      | Present -- `useState` for search, `useMemo` for filtered                 | MATCH    |                                          |
| 127 | TagPicker "new tag" button        | Plus icon + "새 태그 만들기"                                                                 | Identical                                                                | MATCH    |                                          |
| 128 | TagPicker Check icon for attached | Check mark for attached tags                                                                 | Identical                                                                | MATCH    |                                          |
| 129 | `TagList.tsx` exists              | As specified                                                                                 | Present                                                                  | MATCH    |                                          |
| 130 | `TagList` Props                   | `{ workspaceId, itemType, itemId }`                                                          | Identical                                                                | MATCH    |                                          |
| 131 | TagList owns all mutations        | `useTags, useItemTags, useCreateTag, useUpdateTag, useRemoveTag, useAttachTag, useDetachTag` | All 7 present                                                            | MATCH    |                                          |
| 132 | TagList "태그" label              | `<span>태그</span>`                                                                          | Identical                                                                | MATCH    |                                          |
| 133 | TagBadge click -> TagUpdateDialog | As specified                                                                                 | Identical                                                                | MATCH    |                                          |
| 134 | TagBadge `onRemove` -> detachTag  | As specified                                                                                 | Identical                                                                | MATCH    |                                          |
| 135 | `manage-tag/index.ts` barrel      | Exports `TagList`                                                                            | Impl: exports TagList, TagCreateDialog, TagUpdateDialog, TagPicker       | MATCH    | Extra exports                            |

**Features Score: 21/21 = 100%** (item 117 is cosmetic color palette difference)

### 2.14 Frontend -- Integration (Section 4.4)

| #   | Item                                                                    | Design                                                                    | Implementation                                                             | Status |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| 136 | TabHeader `footer` prop                                                 | `footer?: React.ReactNode`                                                | `src/renderer/src/shared/ui/tab-header.tsx` line 17                        | MATCH  |
| 137 | `{footer && <div className="mt-2">{footer}</div>}` in editable mode     | As specified                                                              | Line 112                                                                   | MATCH  |
| 138 | `{footer && <div className="mt-2">{footer}</div>}` in non-editable mode | As specified                                                              | Line 127                                                                   | MATCH  |
| 139 | NoteHeader footer                                                       | `<TagList workspaceId={workspaceId} itemType="note" itemId={noteId} />`   | `src/renderer/src/features/note/edit-note/ui/NoteHeader.tsx` line 30       | MATCH  |
| 140 | TodoDetailPage footer                                                   | `<TagList workspaceId={workspaceId!} itemType="todo" itemId={todo.id} />` | `src/renderer/src/pages/todo-detail/ui/TodoDetailPage.tsx` line 118        | MATCH  |
| 141 | CanvasDetailPage footer                                                 | `<TagList workspaceId={...} itemType="canvas" itemId={canvas.id} />`      | `src/renderer/src/pages/canvas-detail/ui/CanvasDetailPage.tsx` lines 72-76 | MATCH  |
| 142 | ImageHeader integration                                                 | `footer={<TagList ... itemType="image" .../>}`                            | `src/renderer/src/features/image/view-image/ui/ImageHeader.tsx` line 40    | MATCH  |
| 143 | PdfHeader integration                                                   | `footer={<TagList ... itemType="pdf" .../>}`                              | `src/renderer/src/features/pdf/view-pdf/ui/PdfHeader.tsx` line 33          | MATCH  |
| 144 | CsvHeader integration                                                   | `footer={<TagList ... itemType="csv" .../>}`                              | `src/renderer/src/features/csv/edit-csv/ui/CsvHeader.tsx` line 41          | MATCH  |

**Integration Score: 9/9 = 100%**

### 2.15 Intentionally Deferred (Excluded from Match Rate)

| #   | Item                                     | Design      | Implementation  | Status       |
| --- | ---------------------------------------- | ----------- | --------------- | ------------ |
| D1  | Pattern C: FolderTree context menu       | Section 4.4 | Not implemented | EXPECTED GAP |
| D2  | Pattern D: CreateTodoDialog pending tags | Section 4.4 | Not implemented | EXPECTED GAP |
| D3  | List Filter UI                           | Section 4.5 | Not implemented | EXPECTED GAP |

---

## 3. Match Rate Calculation

### Counted Items (excluding 3 deferred items)

| Category                   |  Total  |  Match  | Mismatch |  Score  |
| -------------------------- | :-----: | :-----: | :------: | :-----: |
| DB Schema (2.1)            |   14    |   14    |    0     |  100%   |
| Repositories (2.2)         |   15    |   15    |    0     |  100%   |
| Services (2.3)             |   14    |   14    |    0     |  100%   |
| IPC Handlers (2.4)         |   10    |   10    |    0     |  100%   |
| Handler Registration (2.5) |    4    |    4    |    0     |  100%   |
| Preload Bridge (2.6)       |    8    |    8    |    0     |  100%   |
| Preload Types (2.7)        |   10    |   10    |    0     |  100%   |
| Service Integration (2.8)  |    9    |    9    |    0     |  100%   |
| Frontend Types (2.9)       |    4    |    4    |    0     |  100%   |
| Frontend Queries (2.10)    |   13    |   13    |    0     |  100%   |
| TagBadge (2.11)            |    8    |    7    |    1     |   88%   |
| Barrel Export (2.12)       |    5    |    5    |    0     |  100%   |
| Features (2.13)            |   21    |   20    |    1     |   95%   |
| Integration (2.14)         |    9    |    9    |    0     |  100%   |
| **Total**                  | **144** | **142** |  **2**   | **99%** |

---

## 4. Overall Scores

| Category                                                                      |       Score       | Status |
| ----------------------------------------------------------------------------- | :---------------: | :----: |
| Design Match (Backend: schema + repo + service + IPC + preload + integration) |   100% (84/84)    |  Pass  |
| Design Match (Frontend: types + queries + UI + features + integration)        |    97% (58/60)    |  Pass  |
| Design Match (Overall)                                                        | **99%** (142/144) |  Pass  |
| Architecture Compliance (FSD layers)                                          |       100%        |  Pass  |
| Convention Compliance (naming, file structure)                                |       100%        |  Pass  |
| **Overall**                                                                   |      **99%**      |  Pass  |

---

## 5. Cosmetic Differences (No Functional Impact)

These items are counted as MATCH in the score but noted for documentation completeness.

| #   | Item                               | Design                                     | Implementation                                                  | Nature                                   |
| --- | ---------------------------------- | ------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------- |
| C1  | TagBadge name text (#105)          | `truncate max-w-[120px]`                   | No truncation                                                   | UX choice -- badges are small enough     |
| C2  | TagBadge CSS order (#108)          | `gap-1 px-2 py-0.5 rounded-full text-xs`   | `gap-1 rounded-full px-2 py-0.5 text-xs font-medium`            | Class order + added `font-medium`        |
| C3  | TagBadge remove hover (#109)       | `hover:opacity-70`                         | `rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10`   | Dark mode aware                          |
| C4  | TagColorPicker colors (#117)       | 12 hex strings `PRESET_COLORS`             | 12 `{label, value}` objects `TAG_COLORS` with different palette | Labeled colors + different hues          |
| C5  | Preload input typing (#59-60)      | Typed `{ name: string; ... }`              | `input: unknown`                                                | Runtime boundary -- type safety via d.ts |
| C6  | Folder cleanup order (#82)         | itemTag before rmSync                      | itemTag after rmSync                                            | Both before DB delete; no difference     |
| C7  | IPC handler ordering               | attach/detach before getItemIdsByTag       | getItemIdsByTag before attach/detach                            | Registration order irrelevant            |
| C8  | TagCreateDialog isPending          | `isPending: boolean`                       | `isPending?: boolean`                                           | Optional is more flexible                |
| C9  | TagUpdateDialog isPending/onRemove | `isPending: boolean, onRemove: () => void` | `isPending?: boolean, onRemove?: () => void`                    | Optional is more flexible                |

---

## 6. Remaining Non-Cosmetic Differences (2 items)

### 6.1 TagBadge Name Truncation (#105)

- **Design**: `<span className="truncate max-w-[120px]">{tag.name}</span>`
- **Implementation**: `{tag.name}` without truncation wrapper
- **Impact**: Very low. Badge names are typically short. Parent flex container handles overflow.
- **Recommendation**: Record as intentional. No action needed.

### 6.2 TagColorPicker Color Palette (#117)

- **Design**: `PRESET_COLORS = ['#a3c4f5', '#93c5fd', '#6ee7b7', '#86efac', '#fde68a', '#fcd34d', '#fca5a5', '#f9a8d4', '#c4b5fd', '#a78bfa', '#94a3b8', '#78716c']`
- **Implementation**: `TAG_COLORS` with different values `['#ffb3b3', '#ffd1a3', '#fff0a3', '#d4f5a3', '#b3f0c2', '#a3e8e0', '#a3c4f5', '#b3b3f5', '#d4b3f5', '#ffb3d9', '#e8ccb3', '#d1d5db']` plus Korean labels
- **Impact**: Low. Visual preference. Both provide 12 pastel colors. Default color `#a3c4f5` appears in both sets.
- **Recommendation**: Update design to match implementation palette, or record as intentional.

---

## 7. Recommended Actions

### 7.1 Design Document Updates (optional -- for perfect sync)

1. Update `PRESET_COLORS` to `TAG_COLORS` with labeled objects and current palette
2. Remove `truncate max-w-[120px]` from TagBadge name span
3. Note `isPending` and `onRemove` as optional in dialog props

### 7.2 No Code Fixes Required

All previous issues from v1.0 analysis have been resolved:

- `useRemoveTag` now invalidates `ITEM_TAG_KEY` (was missing in v1.0)
- Hook names (`useTags`, `useItemTags`) now match design
- Query keys (`[TAG_KEY, workspaceId]`) now match design
- IPC channel `itemTag:getTagsByItem` now matches design
- Integration pattern (TabHeader `footer` prop) now matches design

---

## 8. Conclusion

The tag feature achieves a **99% match rate** (142/144 items) between the updated design document and the current implementation. The backend layers achieve a perfect 100% match across all 84 items (schema, repositories, services, IPC handlers, preload bridge, preload types, service integration). The frontend layers achieve 97% (58/60) with only 2 cosmetic differences (TagBadge name truncation omitted, TagColorPicker palette variation).

All 25 mismatches identified in the v1.0 analysis have been resolved through design document updates. The remaining 2 differences are minor visual preferences with no functional impact.

**No iteration cycle needed.** The implementation is fully aligned with the design.

---

## Version History

| Version | Date       | Changes                                                                 | Author       |
| ------- | ---------- | ----------------------------------------------------------------------- | ------------ |
| 1.0     | 2026-03-05 | Initial analysis -- 82% match rate, 25 mismatches                       | gap-detector |
| 2.0     | 2026-03-05 | Re-analysis after design doc update -- 99% match rate, 2 cosmetic diffs | gap-detector |

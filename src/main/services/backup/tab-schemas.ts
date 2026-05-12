import { z } from 'zod'

/**
 * tab_sessions / tab_snapshots 의 JSON 내부 구조 zod 스키마.
 *
 * renderer 의 `entities/tab-system` 타입 (Tab, Pane, LayoutNode) 와 정합.
 * any 제거 위해 P0-2 Phase 4 에서 도입.
 *
 * .passthrough() — 미지 필드 호환성 유지 (앞으로의 Tab 타입 확장 대비).
 */

export const TabSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    icon: z.string(),
    pathname: z.string(),
    searchParams: z.record(z.string(), z.string()).optional(),
    pinned: z.boolean(),
    createdAt: z.number(),
    lastAccessedAt: z.number(),
    error: z.boolean().optional()
  })
  .passthrough()

export const PaneSchema = z
  .object({
    id: z.string(),
    tabIds: z.array(z.string()),
    activeTabId: z.string().nullable(),
    size: z.number(),
    minSize: z.number()
  })
  .passthrough()

// LayoutNode 는 재귀 union — z.lazy() 활용
const PaneLayoutNodeSchema = z
  .object({
    id: z.string(),
    type: z.literal('pane'),
    paneId: z.string()
  })
  .passthrough()

// SplitNode 는 children 재귀 — z.lazy 로 해결
type SplitNodeShape = {
  id: string
  type: 'split'
  direction: 'horizontal' | 'vertical'
  children: LayoutNodeShape[]
  sizes: number[]
}
type LayoutNodeShape = z.infer<typeof PaneLayoutNodeSchema> | SplitNodeShape

const SplitLayoutNodeSchema: z.ZodType<SplitNodeShape> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      type: z.literal('split'),
      direction: z.enum(['horizontal', 'vertical']),
      children: z.array(LayoutNodeSchema),
      sizes: z.array(z.number())
    })
    .passthrough()
)

export const LayoutNodeSchema: z.ZodType<LayoutNodeShape> = z.union([
  PaneLayoutNodeSchema,
  SplitLayoutNodeSchema
])

// Map 형태 (Record<string, Tab/Pane>)
export const TabsMapSchema = z.record(z.string(), TabSchema)
export const PanesMapSchema = z.record(z.string(), PaneSchema)

// 추론 타입 export
export type TabImport = z.infer<typeof TabSchema>
export type PaneImport = z.infer<typeof PaneSchema>
export type LayoutNodeImport = LayoutNodeShape
export type TabsMapImport = z.infer<typeof TabsMapSchema>
export type PanesMapImport = z.infer<typeof PanesMapSchema>

import { z } from 'zod'

export const TabSnapshotSchema = z.object({
  id: z.string(),
  name: z.string().min(1, '스냅샷 이름은 필수입니다'),
  description: z.string().nullable(),
  workspaceId: z.string(),
  tabsJson: z.string(),
  panesJson: z.string(),
  layoutJson: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
})

export type TabSnapshot = z.infer<typeof TabSnapshotSchema>

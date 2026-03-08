import { z } from 'zod'

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, '워크스페이스 이름은 필수입니다'),
  path: z.string().min(1, '워크스페이스 경로는 필수입니다'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
})

export type Workspace = z.infer<typeof WorkspaceSchema>

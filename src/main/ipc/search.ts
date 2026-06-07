import { ipcMain } from 'electron'
import { z } from 'zod'
import { validateIpcAsync, idSchema } from '../lib/ipc-validate'
import { searchService } from '../services/search'

const searchOptionsSchema = z
  .object({
    types: z.array(z.enum(['note', 'table', 'canvas', 'todo', 'pdf', 'image'])).optional(),
    offset: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().max(100).optional(),
    highlight: z.boolean().optional(),
    mode: z.enum(['semantic', 'keyword', 'hybrid']).optional()
  })
  .optional()

export function registerSearchHandlers(): void {
  ipcMain.handle(
    'search:query',
    validateIpcAsync(
      [idSchema, z.string().max(1000), searchOptionsSchema] as const,
      (workspaceId, query, options) => searchService.search(workspaceId, query, options ?? {})
    )
  )
}

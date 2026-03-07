import type { Router } from '../router'
import { noteService } from '../../services/note'

export function registerSearchRoutes(router: Router): void {
  router.addRoute('GET', '/api/workspaces/:wsId/notes/search', async (params, _body, query) => {
    const q = query.get('q') || ''
    if (!q.trim()) return { results: [] }

    const results = await noteService.search(params.wsId, q)
    return { results }
  })
}

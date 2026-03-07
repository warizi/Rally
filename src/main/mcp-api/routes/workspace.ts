import type { Router } from '../router'
import { workspaceRepository } from '../../repositories/workspace'

export function registerWorkspaceRoutes(router: Router): void {
  router.addRoute('GET', '/api/workspaces', () => {
    const workspaces = workspaceRepository.findAll()
    return {
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        path: w.path
      }))
    }
  })
}

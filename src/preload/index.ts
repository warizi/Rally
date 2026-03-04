import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { TabSessionInsert } from '../main/repositories/tab-session'

type TabSnapshotCreateInput = {
  name: string
  description?: string
  workspaceId: string
  tabsJson: string
  panesJson: string
  layoutJson: string
}

const api = {
  note: {
    readByWorkspace: (workspaceId: string) =>
      ipcRenderer.invoke('note:readByWorkspace', workspaceId),
    create: (workspaceId: string, folderId: string | null, name: string) =>
      ipcRenderer.invoke('note:create', workspaceId, folderId, name),
    rename: (workspaceId: string, noteId: string, newName: string) =>
      ipcRenderer.invoke('note:rename', workspaceId, noteId, newName),
    remove: (workspaceId: string, noteId: string) =>
      ipcRenderer.invoke('note:remove', workspaceId, noteId),
    readContent: (workspaceId: string, noteId: string) =>
      ipcRenderer.invoke('note:readContent', workspaceId, noteId),
    writeContent: (workspaceId: string, noteId: string, content: string) =>
      ipcRenderer.invoke('note:writeContent', workspaceId, noteId, content),
    move: (workspaceId: string, noteId: string, folderId: string | null, index: number) =>
      ipcRenderer.invoke('note:move', workspaceId, noteId, folderId, index),
    updateMeta: (workspaceId: string, noteId: string, data: { description?: string }) =>
      ipcRenderer.invoke('note:updateMeta', workspaceId, noteId, data),
    onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        workspaceId: string,
        changedRelPaths: string[]
      ): void => callback(workspaceId, changedRelPaths)
      ipcRenderer.on('note:changed', handler)
      return () => ipcRenderer.removeListener('note:changed', handler)
    }
  },

  csv: {
    readByWorkspace: (workspaceId: string) =>
      ipcRenderer.invoke('csv:readByWorkspace', workspaceId),
    create: (workspaceId: string, folderId: string | null, name: string) =>
      ipcRenderer.invoke('csv:create', workspaceId, folderId, name),
    rename: (workspaceId: string, csvId: string, newName: string) =>
      ipcRenderer.invoke('csv:rename', workspaceId, csvId, newName),
    remove: (workspaceId: string, csvId: string) =>
      ipcRenderer.invoke('csv:remove', workspaceId, csvId),
    readContent: (workspaceId: string, csvId: string) =>
      ipcRenderer.invoke('csv:readContent', workspaceId, csvId),
    writeContent: (workspaceId: string, csvId: string, content: string) =>
      ipcRenderer.invoke('csv:writeContent', workspaceId, csvId, content),
    move: (workspaceId: string, csvId: string, folderId: string | null, index: number) =>
      ipcRenderer.invoke('csv:move', workspaceId, csvId, folderId, index),
    updateMeta: (
      workspaceId: string,
      csvId: string,
      data: { description?: string; columnWidths?: string }
    ) => ipcRenderer.invoke('csv:updateMeta', workspaceId, csvId, data),
    onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        workspaceId: string,
        changedRelPaths: string[]
      ): void => callback(workspaceId, changedRelPaths)
      ipcRenderer.on('csv:changed', handler)
      return () => ipcRenderer.removeListener('csv:changed', handler)
    }
  },

  pdf: {
    readByWorkspace: (workspaceId: string) =>
      ipcRenderer.invoke('pdf:readByWorkspace', workspaceId),
    import: (workspaceId: string, folderId: string | null, sourcePath: string) =>
      ipcRenderer.invoke('pdf:import', workspaceId, folderId, sourcePath),
    rename: (workspaceId: string, pdfId: string, newName: string) =>
      ipcRenderer.invoke('pdf:rename', workspaceId, pdfId, newName),
    remove: (workspaceId: string, pdfId: string) =>
      ipcRenderer.invoke('pdf:remove', workspaceId, pdfId),
    readContent: (workspaceId: string, pdfId: string) =>
      ipcRenderer.invoke('pdf:readContent', workspaceId, pdfId),
    move: (workspaceId: string, pdfId: string, folderId: string | null, index: number) =>
      ipcRenderer.invoke('pdf:move', workspaceId, pdfId, folderId, index),
    updateMeta: (workspaceId: string, pdfId: string, data: { description?: string }) =>
      ipcRenderer.invoke('pdf:updateMeta', workspaceId, pdfId, data),
    selectFile: () => ipcRenderer.invoke('pdf:selectFile'),
    onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        workspaceId: string,
        changedRelPaths: string[]
      ): void => callback(workspaceId, changedRelPaths)
      ipcRenderer.on('pdf:changed', handler)
      return () => ipcRenderer.removeListener('pdf:changed', handler)
    }
  },

  image: {
    readByWorkspace: (workspaceId: string) =>
      ipcRenderer.invoke('image:readByWorkspace', workspaceId),
    import: (workspaceId: string, folderId: string | null, sourcePath: string) =>
      ipcRenderer.invoke('image:import', workspaceId, folderId, sourcePath),
    rename: (workspaceId: string, imageId: string, newName: string) =>
      ipcRenderer.invoke('image:rename', workspaceId, imageId, newName),
    remove: (workspaceId: string, imageId: string) =>
      ipcRenderer.invoke('image:remove', workspaceId, imageId),
    readContent: (workspaceId: string, imageId: string) =>
      ipcRenderer.invoke('image:readContent', workspaceId, imageId),
    move: (workspaceId: string, imageId: string, folderId: string | null, index: number) =>
      ipcRenderer.invoke('image:move', workspaceId, imageId, folderId, index),
    updateMeta: (workspaceId: string, imageId: string, data: { description?: string }) =>
      ipcRenderer.invoke('image:updateMeta', workspaceId, imageId, data),
    selectFile: () => ipcRenderer.invoke('image:selectFile'),
    onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        workspaceId: string,
        changedRelPaths: string[]
      ): void => callback(workspaceId, changedRelPaths)
      ipcRenderer.on('image:changed', handler)
      return () => ipcRenderer.removeListener('image:changed', handler)
    }
  },

  noteImage: {
    saveFromPath: (workspaceId: string, sourcePath: string) =>
      ipcRenderer.invoke('noteImage:saveFromPath', workspaceId, sourcePath),
    saveFromBuffer: (workspaceId: string, buffer: ArrayBuffer, ext: string) =>
      ipcRenderer.invoke('noteImage:saveFromBuffer', workspaceId, buffer, ext),
    readImage: (workspaceId: string, relativePath: string) =>
      ipcRenderer.invoke('noteImage:readImage', workspaceId, relativePath)
  },

  folder: {
    readTree: (workspaceId: string) => ipcRenderer.invoke('folder:readTree', workspaceId),
    create: (workspaceId: string, parentFolderId: string | null, name: string) =>
      ipcRenderer.invoke('folder:create', workspaceId, parentFolderId, name),
    rename: (workspaceId: string, folderId: string, newName: string) =>
      ipcRenderer.invoke('folder:rename', workspaceId, folderId, newName),
    remove: (workspaceId: string, folderId: string) =>
      ipcRenderer.invoke('folder:remove', workspaceId, folderId),
    move: (workspaceId: string, folderId: string, parentFolderId: string | null, index: number) =>
      ipcRenderer.invoke('folder:move', workspaceId, folderId, parentFolderId, index),
    updateMeta: (
      workspaceId: string,
      folderId: string,
      data: { color?: string | null; order?: number }
    ) => ipcRenderer.invoke('folder:updateMeta', workspaceId, folderId, data),
    onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        workspaceId: string,
        changedRelPaths: string[]
      ): void => callback(workspaceId, changedRelPaths)
      ipcRenderer.on('folder:changed', handler)
      return () => ipcRenderer.removeListener('folder:changed', handler)
    }
  },

  tabSession: {
    getByWorkspaceId: (workspaceId: string) =>
      ipcRenderer.invoke('tabSession:getByWorkspaceId', workspaceId),
    upsert: (data: Omit<TabSessionInsert, 'updatedAt'>) =>
      ipcRenderer.invoke('tabSession:upsert', data)
  },

  tabSnapshot: {
    getByWorkspaceId: (workspaceId: string) =>
      ipcRenderer.invoke('tabSnapshot:getByWorkspaceId', workspaceId),
    create: (data: TabSnapshotCreateInput) => ipcRenderer.invoke('tabSnapshot:create', data),
    update: (id: string, data: { name?: string; description?: string }) =>
      ipcRenderer.invoke('tabSnapshot:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('tabSnapshot:delete', id)
  },

  workspace: {
    getAll: () => ipcRenderer.invoke('workspace:getAll'),
    getById: (id: string) => ipcRenderer.invoke('workspace:getById', id),
    create: (name: string, path: string) => ipcRenderer.invoke('workspace:create', name, path),
    update: (id: string, data: unknown) => ipcRenderer.invoke('workspace:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('workspace:delete', id),
    selectDirectory: () => ipcRenderer.invoke('workspace:selectDirectory')
  },

  todo: {
    findByWorkspace: (workspaceId: string, options?: { filter?: 'all' | 'active' | 'completed' }) =>
      ipcRenderer.invoke('todo:findByWorkspace', workspaceId, options),
    create: (workspaceId: string, data: unknown) =>
      ipcRenderer.invoke('todo:create', workspaceId, data),
    update: (todoId: string, data: unknown) => ipcRenderer.invoke('todo:update', todoId, data),
    remove: (todoId: string) => ipcRenderer.invoke('todo:remove', todoId),
    reorderList: (workspaceId: string, updates: unknown[]) =>
      ipcRenderer.invoke('todo:reorderList', workspaceId, updates),
    reorderKanban: (workspaceId: string, updates: unknown[]) =>
      ipcRenderer.invoke('todo:reorderKanban', workspaceId, updates),
    reorderSub: (parentId: string, updates: unknown[]) =>
      ipcRenderer.invoke('todo:reorderSub', parentId, updates)
  },

  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value)
  },

  entityLink: {
    link: (typeA: string, idA: string, typeB: string, idB: string, workspaceId: string) =>
      ipcRenderer.invoke('entityLink:link', typeA, idA, typeB, idB, workspaceId),
    unlink: (typeA: string, idA: string, typeB: string, idB: string) =>
      ipcRenderer.invoke('entityLink:unlink', typeA, idA, typeB, idB),
    getLinked: (entityType: string, entityId: string) =>
      ipcRenderer.invoke('entityLink:getLinked', entityType, entityId)
  },

  canvas: {
    findByWorkspace: (workspaceId: string, options?: { search?: string }) =>
      ipcRenderer.invoke('canvas:findByWorkspace', workspaceId, options),
    findById: (canvasId: string) => ipcRenderer.invoke('canvas:findById', canvasId),
    create: (workspaceId: string, data: unknown) =>
      ipcRenderer.invoke('canvas:create', workspaceId, data),
    update: (canvasId: string, data: unknown) =>
      ipcRenderer.invoke('canvas:update', canvasId, data),
    updateViewport: (canvasId: string, viewport: unknown) =>
      ipcRenderer.invoke('canvas:updateViewport', canvasId, viewport),
    remove: (canvasId: string) => ipcRenderer.invoke('canvas:remove', canvasId)
  },

  canvasNode: {
    findByCanvas: (canvasId: string) => ipcRenderer.invoke('canvasNode:findByCanvas', canvasId),
    create: (canvasId: string, data: unknown) =>
      ipcRenderer.invoke('canvasNode:create', canvasId, data),
    update: (nodeId: string, data: unknown) =>
      ipcRenderer.invoke('canvasNode:update', nodeId, data),
    updatePositions: (updates: unknown) =>
      ipcRenderer.invoke('canvasNode:updatePositions', updates),
    remove: (nodeId: string) => ipcRenderer.invoke('canvasNode:remove', nodeId),
    syncState: (canvasId: string, data: unknown) =>
      ipcRenderer.invoke('canvasNode:syncState', canvasId, data)
  },

  canvasEdge: {
    findByCanvas: (canvasId: string) => ipcRenderer.invoke('canvasEdge:findByCanvas', canvasId),
    create: (canvasId: string, data: unknown) =>
      ipcRenderer.invoke('canvasEdge:create', canvasId, data),
    update: (edgeId: string, data: unknown) =>
      ipcRenderer.invoke('canvasEdge:update', edgeId, data),
    remove: (edgeId: string) => ipcRenderer.invoke('canvasEdge:remove', edgeId)
  },

  schedule: {
    findAllByWorkspace: (workspaceId: string) =>
      ipcRenderer.invoke('schedule:findAllByWorkspace', workspaceId),
    findByWorkspace: (workspaceId: string, range: unknown) =>
      ipcRenderer.invoke('schedule:findByWorkspace', workspaceId, range),
    findById: (scheduleId: string) => ipcRenderer.invoke('schedule:findById', scheduleId),
    create: (workspaceId: string, data: unknown) =>
      ipcRenderer.invoke('schedule:create', workspaceId, data),
    update: (scheduleId: string, data: unknown) =>
      ipcRenderer.invoke('schedule:update', scheduleId, data),
    remove: (scheduleId: string) => ipcRenderer.invoke('schedule:remove', scheduleId),
    move: (scheduleId: string, startAt: unknown, endAt: unknown) =>
      ipcRenderer.invoke('schedule:move', scheduleId, startAt, endAt),
    linkTodo: (scheduleId: string, todoId: string) =>
      ipcRenderer.invoke('schedule:linkTodo', scheduleId, todoId),
    unlinkTodo: (scheduleId: string, todoId: string) =>
      ipcRenderer.invoke('schedule:unlinkTodo', scheduleId, todoId),
    getLinkedTodos: (scheduleId: string) =>
      ipcRenderer.invoke('schedule:getLinkedTodos', scheduleId)
  },

  reminder: {
    findByEntity: (entityType: string, entityId: string) =>
      ipcRenderer.invoke('reminder:findByEntity', entityType, entityId),
    set: (data: unknown) => ipcRenderer.invoke('reminder:set', data),
    remove: (reminderId: string) => ipcRenderer.invoke('reminder:remove', reminderId),
    removeByEntity: (entityType: string, entityId: string) =>
      ipcRenderer.invoke('reminder:removeByEntity', entityType, entityId),
    onFired: (
      callback: (data: { entityType: string; entityId: string; title: string }) => void
    ) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        data: { entityType: string; entityId: string; title: string }
      ): void => callback(data)
      ipcRenderer.on('reminder:fired', handler)
      return () => ipcRenderer.removeListener('reminder:fired', handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

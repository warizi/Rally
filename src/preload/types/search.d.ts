import type { IpcResponse } from './common'

export type SearchType = 'note' | 'table' | 'canvas' | 'todo'

export interface SearchHit {
  type: SearchType
  id: string
  title: string
  matchType: 'title' | 'content' | 'description'
  folderId: string | null
  folderPath: string | null
  updatedAt: string
  preview: string | null
  excerpt?: string
}

export interface SearchResultData {
  query: string
  results: SearchHit[]
  total: number
  hasMore: boolean
  nextOffset: number
  meta: {
    types: SearchType[]
    offset: number
    limit: number
    perTypeCounts: Record<SearchType, number>
  }
}

export interface SearchQueryOptions {
  types?: SearchType[]
  offset?: number
  limit?: number
  highlight?: boolean
  mode?: 'semantic' | 'keyword' | 'hybrid'
}

export interface SearchAPI {
  query: (
    workspaceId: string,
    query: string,
    options?: SearchQueryOptions
  ) => Promise<IpcResponse<SearchResultData>>
}

/**
 * 노트 스타일 템플릿 React Query 훅.
 *
 * - list: useQuery
 * - create / remove: useMutation + 캐시 invalidate
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export interface NoteStyleTemplate {
  id: string
  name: string
  settingsJson: string
  createdAt: Date
}

const QUERY_KEY = ['note-style-templates']

export function useNoteStyleTemplates(): {
  templates: NoteStyleTemplate[]
  isLoading: boolean
} {
  const query = useQuery<NoteStyleTemplate[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await window.api.noteStyleTemplate.list()
      if (!res.success) return []
      return ((res.data as NoteStyleTemplate[] | undefined) ?? []).map((t) => ({
        ...t,
        createdAt: t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt)
      }))
    },
    staleTime: Infinity
  })

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading
  }
}

export function useCreateNoteStyleTemplate(): {
  create: (input: { name: string; settingsJson: string }) => Promise<void>
  isPending: boolean
} {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (input: { name: string; settingsJson: string }) => {
      const res = await window.api.noteStyleTemplate.create(input)
      if (!res.success) throw new Error(res.message ?? '템플릿 저장 실패')
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
    }
  })

  return {
    create: async (input) => {
      await mutation.mutateAsync(input)
    },
    isPending: mutation.isPending
  }
}

export function useDeleteNoteStyleTemplate(): {
  remove: (id: string) => Promise<void>
  isPending: boolean
} {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await window.api.noteStyleTemplate.remove(id)
      if (!res.success) throw new Error(res.message ?? '템플릿 삭제 실패')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
    }
  })

  return {
    remove: async (id) => {
      await mutation.mutateAsync(id)
    },
    isPending: mutation.isPending
  }
}

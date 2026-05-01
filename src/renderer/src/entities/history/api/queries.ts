import {
  useInfiniteQuery,
  type UseInfiniteQueryResult,
  type InfiniteData
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { HistoryFetchResult } from '../model/types'

const HISTORY_KEY = 'history'
const DAY_LIMIT = 10

interface UseHistoryParams {
  workspaceId: string
  fromDate?: string | null
  toDate?: string | null
  query?: string | null
}

export function useHistoryInfinite(
  params: UseHistoryParams
): UseInfiniteQueryResult<InfiniteData<HistoryFetchResult>, Error> {
  const { workspaceId, fromDate, toDate, query } = params
  return useInfiniteQuery({
    queryKey: [HISTORY_KEY, workspaceId, fromDate ?? null, toDate ?? null, query ?? null],
    queryFn: async ({ pageParam }): Promise<HistoryFetchResult> => {
      const res: IpcResponse<HistoryFetchResult> = await window.api.history.fetch(workspaceId, {
        dayOffset: pageParam,
        dayLimit: DAY_LIMIT,
        fromDate: fromDate ?? null,
        toDate: toDate ?? null,
        query: query ?? null
      })
      if (!res.success) throwIpcError(res)
      const data = res.data ?? { days: [], hasMore: false, nextDayOffset: 0 }
      return {
        ...data,
        days: data.days.map((d) => ({
          ...d,
          todos: d.todos.map((t) => ({
            ...t,
            doneAt: new Date(t.doneAt)
          }))
        }))
      }
    },
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.nextDayOffset : undefined),
    enabled: !!workspaceId
  })
}

/**
 * 검색 인덱스 stale 임베딩 정리 검증.
 *
 * 테스트 환경은 sqlite-vec 미로드(vecEnabled=false)라 실제 vec/fts 제거는 no-op + 가상테이블 부재.
 * 따라서 임베딩 인덱스 정리는 **embeddingService.remove 호출 흐름**(어느 경로에서 부르고 안 부르는지)으로 검증한다.
 *
 *   - 영구삭제(batch purge) → 임베딩 가능 엔티티마다 remove 호출
 *   - 단일 soft-delete(휴지통) → remove 호출 안 함 (복원 시 재임베딩 불필요)
 *   - 단일 permanent delete → remove 호출
 *   - orphan sweep → vec 비활성 시 no-op(0)
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { trashService } from '../trash'
import { todoService } from '../todo'
import { embeddingService } from '../embedding'
import { seed } from './lib/seed'

let wsDir: string
let removeSpy: MockInstance

beforeEach(() => {
  wsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-emb-'))
  removeSpy = vi.spyOn(embeddingService, 'remove').mockImplementation(() => {})
})

afterEach(() => {
  removeSpy.mockRestore()
  if (wsDir && fs.existsSync(wsDir)) fs.rmSync(wsDir, { recursive: true, force: true })
})

describe('영구삭제(purge) 시 임베딩 인덱스 제거', () => {
  it('batch purge → 임베딩 가능 엔티티마다 embeddingService.remove 호출', () => {
    const ws = seed.workspace({ path: wsDir })
    const todo = seed.todo(ws.id)
    const canvas = seed.canvas(ws.id)
    const sched = seed.schedule(ws.id)

    const todoBatch = trashService.softRemove(ws.id, 'todo', todo.id)
    const canvasBatch = trashService.softRemove(ws.id, 'canvas', canvas.id)
    const schedBatch = trashService.softRemove(ws.id, 'schedule', sched.id)

    removeSpy.mockClear() // soft-delete 단계는 remove 안 부르지만 안전하게 초기화

    trashService.purge(todoBatch)
    expect(removeSpy).toHaveBeenCalledWith('todo', todo.id)

    trashService.purge(canvasBatch)
    expect(removeSpy).toHaveBeenCalledWith('canvas', canvas.id)

    trashService.purge(schedBatch)
    expect(removeSpy).toHaveBeenCalledWith('schedule', sched.id)
  })
})

describe('단일 삭제 임베딩 제거 일관화', () => {
  it('soft-delete(휴지통 이동) → embeddingService.remove 호출 안 함 (임베딩 유지)', () => {
    const ws = seed.workspace({ path: wsDir })
    const todo = seed.todo(ws.id)
    removeSpy.mockClear()

    todoService.remove(todo.id) // 기본 = soft delete

    expect(removeSpy).not.toHaveBeenCalled()
  })

  it('permanent delete → embeddingService.remove 호출', () => {
    const ws = seed.workspace({ path: wsDir })
    const todo = seed.todo(ws.id)
    removeSpy.mockClear()

    todoService.remove(todo.id, { permanent: true })

    expect(removeSpy).toHaveBeenCalledWith('todo', todo.id)
  })
})

describe('orphan sweep', () => {
  it('vec 비활성(test 환경) → no-op 으로 0 반환, throw 없음', () => {
    expect(embeddingService.sweepOrphans()).toBe(0)
  })
})

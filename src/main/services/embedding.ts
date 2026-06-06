import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { and, eq, inArray } from 'drizzle-orm'
import { db, rawSqlite, vecEnabled } from '../db'
import { embeddingMeta } from '../db/schema'
import type { EmbeddableEntityType } from '../db/schema/embedding'
import { embed } from './embedding-model'
import { chunkNote, composeShortText } from './embedding-chunk'
import { EMBEDDING_MODEL } from './embedding-config'
import { scoped } from '../lib/logger'
import { workspaceRepository } from '../repositories/workspace'
import { noteRepository } from '../repositories/note'
import { todoRepository } from '../repositories/todo'
import { scheduleRepository } from '../repositories/schedule'
import { csvFileRepository } from '../repositories/csv-file'
import { canvasRepository } from '../repositories/canvas'

const log = scoped('embedding')

interface Chunk {
  index: number
  text: string
}

interface ResolvedEntity {
  workspaceId: string
  chunks: Chunk[]
}

const DEBOUNCE_MS = 800

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function vecBuffer(vector: number[]): Buffer {
  return Buffer.from(new Float32Array(vector).buffer)
}

/**
 * 엔티티의 현재 임베딩 대상 텍스트를 청크로 변환.
 * 삭제됐거나 조회 불가면 null (호출자가 remove 처리).
 * 순환 import 회피를 위해 repository + fs를 직접 사용한다.
 */
function resolveEntity(type: EmbeddableEntityType, id: string): ResolvedEntity | null {
  switch (type) {
    case 'note': {
      const note = noteRepository.findById(id)
      if (!note) return null
      const ws = workspaceRepository.findById(note.workspaceId)
      if (!ws) return null
      let content = ''
      try {
        content = fs.readFileSync(path.join(ws.path, note.relativePath), 'utf-8')
      } catch {
        content = ''
      }
      return { workspaceId: note.workspaceId, chunks: chunkNote(note.title, content) }
    }
    case 'todo': {
      const todo = todoRepository.findById(id)
      if (!todo) return null
      const text = composeShortText([todo.title, todo.description])
      return { workspaceId: todo.workspaceId, chunks: text ? [{ index: 0, text }] : [] }
    }
    case 'schedule': {
      const s = scheduleRepository.findById(id)
      if (!s || !s.workspaceId) return null
      const text = composeShortText([s.title, s.description, s.location])
      return { workspaceId: s.workspaceId, chunks: text ? [{ index: 0, text }] : [] }
    }
    case 'csv': {
      const c = csvFileRepository.findById(id)
      if (!c) return null
      const text = composeShortText([c.title, c.description, c.preview])
      return { workspaceId: c.workspaceId, chunks: text ? [{ index: 0, text }] : [] }
    }
    case 'canvas': {
      const c = canvasRepository.findById(id)
      if (!c) return null
      const text = composeShortText([c.title, c.description])
      return { workspaceId: c.workspaceId, chunks: text ? [{ index: 0, text }] : [] }
    }
  }
}

function metaId(type: EmbeddableEntityType, id: string, chunkIndex: number): string {
  return `${type}:${id}:${chunkIndex}`
}

function nextRowidBase(): number {
  const row = rawSqlite
    .prepare('SELECT COALESCE(MAX(rowid), 0) AS m FROM embedding_meta')
    .get() as { m: number }
  return Number(row.m) + 1
}

function deleteVecRows(rowids: number[]): void {
  if (rowids.length === 0) return
  const stmt = rawSqlite.prepare('DELETE FROM vec_embeddings WHERE rowid = ?')
  for (const rid of rowids) stmt.run(BigInt(rid))
}

function insertVecRow(rowid: number, vector: number[]): void {
  rawSqlite
    .prepare('INSERT INTO vec_embeddings(rowid, embedding) VALUES (?, ?)')
    .run(BigInt(rowid), vecBuffer(vector))
}

function deleteFtsRows(type: EmbeddableEntityType, id: string): void {
  rawSqlite.prepare('DELETE FROM search_fts WHERE entity_type = ? AND entity_id = ?').run(type, id)
}

function insertFtsRow(type: EmbeddableEntityType, id: string, text: string): void {
  rawSqlite
    .prepare('INSERT INTO search_fts(text, entity_type, entity_id) VALUES (?, ?, ?)')
    .run(text, type, id)
}

/** 엔티티의 모든 임베딩(vec + meta) + FTS 행 제거. */
function removeEntitySync(type: EmbeddableEntityType, id: string): void {
  const rows = db
    .select({ rowid: embeddingMeta.rowid })
    .from(embeddingMeta)
    .where(and(eq(embeddingMeta.entityType, type), eq(embeddingMeta.entityId, id)))
    .all()
  deleteVecRows(rows.map((r) => r.rowid))
  db.delete(embeddingMeta)
    .where(and(eq(embeddingMeta.entityType, type), eq(embeddingMeta.entityId, id)))
    .run()
  deleteFtsRows(type, id)
}

/**
 * 엔티티 임베딩 동기화 (증분).
 * - content_hash 동일한 청크는 skip
 * - 변경/신규 청크만 임베딩 후 vec/meta upsert
 * - 사라진 청크(chunkIndex >= 현재 청크 수)는 제거
 */
async function processEntity(type: EmbeddableEntityType, id: string): Promise<void> {
  if (!vecEnabled) return

  const resolved = resolveEntity(type, id)
  if (!resolved) {
    removeEntitySync(type, id)
    return
  }
  const { workspaceId, chunks } = resolved

  const existing = db
    .select()
    .from(embeddingMeta)
    .where(and(eq(embeddingMeta.entityType, type), eq(embeddingMeta.entityId, id)))
    .all()
  const existingByIndex = new Map(existing.map((r) => [r.chunkIndex, r]))

  // 변경/신규 청크 선별
  const toEmbed: { chunk: Chunk; hash: string; rowid: number }[] = []
  let rowidCursor = nextRowidBase()
  for (const chunk of chunks) {
    const h = hashText(chunk.text)
    const prev = existingByIndex.get(chunk.index)
    if (prev && prev.contentHash === h && prev.model === EMBEDDING_MODEL) continue
    const rowid = prev ? prev.rowid : rowidCursor++
    toEmbed.push({ chunk, hash: h, rowid })
  }

  // 사라진 청크 제거 (현재 청크 수보다 큰 index)
  const staleRows = existing.filter((r) => r.chunkIndex >= chunks.length)

  if (toEmbed.length === 0 && staleRows.length === 0) return

  const vectors =
    toEmbed.length > 0
      ? await embed(
          toEmbed.map((t) => t.chunk.text),
          'passage'
        )
      : []

  // FTS는 모델 불필요 — 변경이 있으면 엔티티 전체 텍스트로 항상 재구성.
  const ftsText = chunks.map((c) => c.text).join('\n')

  const now = new Date()
  const tx = rawSqlite.transaction(() => {
    // FTS 재구성 (엔티티당 1행)
    deleteFtsRows(type, id)
    if (ftsText.trim()) insertFtsRow(type, id, ftsText)

    // stale 제거
    if (staleRows.length > 0) {
      deleteVecRows(staleRows.map((r) => r.rowid))
      db.delete(embeddingMeta)
        .where(
          inArray(
            embeddingMeta.id,
            staleRows.map((r) => r.id)
          )
        )
        .run()
    }
    // 변경분 upsert
    toEmbed.forEach((item, i) => {
      deleteVecRows([item.rowid]) // 기존 동일 rowid 제거 후 재삽입 (vec0는 update 미지원)
      insertVecRow(item.rowid, vectors[i])
      const mid = metaId(type, id, item.chunk.index)
      db.insert(embeddingMeta)
        .values({
          id: mid,
          workspaceId,
          entityType: type,
          entityId: id,
          chunkIndex: item.chunk.index,
          rowid: item.rowid,
          contentHash: item.hash,
          model: EMBEDDING_MODEL,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: embeddingMeta.id,
          set: { rowid: item.rowid, contentHash: item.hash, model: EMBEDDING_MODEL, updatedAt: now }
        })
        .run()
    })
  })
  tx()
}

// ── 비동기 디바운스 큐 ────────────────────────────────────────
const timers = new Map<string, NodeJS.Timeout>()

function runSafely(type: EmbeddableEntityType, id: string): void {
  processEntity(type, id).catch((e) => {
    log.warn(`embedding sync failed for ${type}:${id}`, e)
  })
}

export const embeddingService = {
  /** 엔티티 변경 시 호출 — 비동기·디바운스로 임베딩 동기화 (저장 경로를 블로킹하지 않음). */
  enqueue(type: EmbeddableEntityType, id: string): void {
    if (!vecEnabled) return
    const key = `${type}:${id}`
    const prev = timers.get(key)
    if (prev) clearTimeout(prev)
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key)
        runSafely(type, id)
      }, DEBOUNCE_MS)
    )
  },

  /** 엔티티 삭제 시 호출 — 임베딩 즉시 제거. */
  remove(type: EmbeddableEntityType, id: string): void {
    if (!vecEnabled) return
    const key = `${type}:${id}`
    const prev = timers.get(key)
    if (prev) {
      clearTimeout(prev)
      timers.delete(key)
    }
    try {
      removeEntitySync(type, id)
    } catch (e) {
      log.warn(`embedding remove failed for ${type}:${id}`, e)
    }
  },

  /** 동기 처리(백필/테스트용). */
  async syncNow(type: EmbeddableEntityType, id: string): Promise<void> {
    await processEntity(type, id)
  }
}

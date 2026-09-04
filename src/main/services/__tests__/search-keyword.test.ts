/**
 * 키워드(FTS) 검색 경로 — vecEnabled=true 로 hybridSearch 의 keyword 모드를 실제 FTS5 테이블로 검증.
 *
 * 배경 (2026-09-03 "전체 검색 오류"): 전체 검색의 '일치' 그룹이 keyword 모드인데
 *   1) FTS 후보를 embedding_meta EXISTS 로 격리해 재임베딩 중/모델 부재 시 결과가 비었고
 *   2) trigram 토크나이저가 3자 미만 질의를 못 찾았고
 *   3) pdf/image 는 점수 정렬 뒤에 붙어 제목이 일치해도 상위 N 절단 밖으로 나갔다.
 *
 * setup.ts 의 db 모킹(vecEnabled=false)을 이 파일에서 vecEnabled=true + 실제 FTS5 로 덮어쓴다.
 * vi.mock 팩토리는 호이스팅되므로 DB 는 vi.hoisted 안에서 만든다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { sqlite, db } = await vi.hoisted(async () => {
  const Database = (await import('better-sqlite3')).default
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')
  const schema = await import('../../db/schema')
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: './src/main/db/migrations' })
  sqlite.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
       text, entity_type UNINDEXED, entity_id UNINDEXED, tokenize='trigram')`
  )
  // notes/pdf_files 가 workspaces 를 FK 로 참조 — 테스트 워크스페이스 2개를 미리 넣는다
  for (const id of ['ws-1', 'ws-2']) {
    db.insert(schema.workspaces)
      .values({ id, name: id, path: `/${id}`, createdAt: new Date(), updatedAt: new Date() })
      .run()
  }
  return { sqlite, db }
})

vi.mock('../../db', () => ({ db, rawSqlite: sqlite, vecEnabled: true }))
vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: {
    findById: (id: string) =>
      id === 'ws-1' || id === 'ws-2'
        ? { id, name: id, path: `/${id}`, createdAt: new Date(), updatedAt: new Date() }
        : null
  }
}))
vi.mock('../../repositories/folder', () => ({
  folderRepository: { findByWorkspaceId: () => [] }
}))
vi.mock('../embedding-model', () => ({ embed: vi.fn() }))
vi.mock('../model-bootstrap', () => ({ ensureModel: vi.fn() }))
vi.mock('../../lib/embedding-progress', () => ({ emitEmbeddingProgress: vi.fn() }))
vi.mock('../../repositories/note', async () => {
  const { eq } = await import('drizzle-orm')
  const schema = await import('../../db/schema')
  return {
    noteRepository: {
      findById: (id: string) =>
        db.select().from(schema.notes).where(eq(schema.notes.id, id)).get() ?? null
    }
  }
})

import * as schema from '../../db/schema'
import { eq } from 'drizzle-orm'
import { searchService } from '../search'
import { embeddingService } from '../embedding'
import { embed } from '../embedding-model'
import { ensureModel } from '../model-bootstrap'

const T0 = new Date('2026-09-01T00:00:00Z')
const now = (): Date => new Date()

function fts(type: string, id: string, text: string): void {
  sqlite
    .prepare('INSERT INTO search_fts(text, entity_type, entity_id) VALUES (?, ?, ?)')
    .run(text, type, id)
}

function note(id: string, title: string, ws = 'ws-1', updatedAt = T0): void {
  db.insert(schema.notes)
    .values({
      id,
      workspaceId: ws,
      folderId: null,
      title,
      relativePath: `${title}.md`,
      preview: `${title} 본문 미리보기`,
      createdAt: updatedAt,
      updatedAt
    })
    .run()
}

function pdf(id: string, title: string, ws = 'ws-1'): void {
  db.insert(schema.pdfFiles)
    .values({
      id,
      workspaceId: ws,
      folderId: null,
      title,
      relativePath: `${title}.pdf`,
      description: '',
      createdAt: T0,
      updatedAt: T0
    })
    .run()
}

beforeEach(() => {
  sqlite.exec('DELETE FROM search_fts')
  for (const t of ['embedding_meta', 'pdf_files', 'image_files', 'notes'] as const) {
    sqlite.exec(`DELETE FROM ${t}`)
  }
  vi.clearAllMocks()
})

const ALL: Parameters<typeof searchService.search>[2] = {
  types: ['note', 'table', 'canvas', 'todo', 'pdf', 'image'],
  mode: 'keyword',
  limit: 100
}

describe('keyword 검색 — embedding_meta 없이 FTS 만으로 동작', () => {
  it('임베딩(meta) 행이 없어도 FTS 행만 있으면 찾는다', async () => {
    note('n-1', '분기 보고서')
    fts('note', 'n-1', '분기 보고서\n매출 분석 내용')
    const r = await searchService.search('ws-1', '매출 분석', ALL)
    expect(r.results.map((h) => h.id)).toEqual(['n-1'])
    expect(r.results[0].matchType).toBe('content')
  })

  it('다른 워크스페이스의 FTS 행은 메타 단계에서 걸러진다', async () => {
    note('n-1', '회의록 A', 'ws-1')
    note('n-2', '회의록 B', 'ws-2')
    fts('note', 'n-1', '회의록 A 프로젝트 킥오프')
    fts('note', 'n-2', '회의록 B 프로젝트 킥오프')
    const r = await searchService.search('ws-1', '킥오프', ALL)
    expect(r.results.map((h) => h.id)).toEqual(['n-1'])
  })

  it('휴지통(soft-delete) 엔티티는 FTS 행이 남아 있어도 제외', async () => {
    note('n-1', '삭제된 노트')
    db.update(schema.notes).set({ deletedAt: now() }).where(eq(schema.notes.id, 'n-1')).run()
    fts('note', 'n-1', '삭제된 노트 고유단어')
    const r = await searchService.search('ws-1', '고유단어', ALL)
    expect(r.results).toEqual([])
  })
})

describe('keyword 검색 — 3자 미만 질의 (trigram 한계)', () => {
  it('2자 한국어 질의도 substring 으로 찾는다', async () => {
    note('n-1', '주간 회의')
    fts('note', 'n-1', '주간 회의\n안건 정리')
    const r = await searchService.search('ws-1', '회의', ALL)
    expect(r.results.map((h) => h.id)).toEqual(['n-1'])
  })

  it('LIKE 와일드카드 문자는 리터럴로 취급 (% _ 가 패턴이 되지 않는다)', async () => {
    note('n-1', '진행률')
    fts('note', 'n-1', '진행률 50%')
    note('n-2', '무관')
    fts('note', 'n-2', '아무 내용')
    expect((await searchService.search('ws-1', '0%', ALL)).results.map((h) => h.id)).toEqual([
      'n-1'
    ])
    expect((await searchService.search('ws-1', '%', ALL)).results.map((h) => h.id)).toEqual(['n-1'])
  })

  it('3자 이상은 FTS MATCH 로 찾는다 (bm25 순위)', async () => {
    note('n-1', '릴리스 노트')
    fts('note', 'n-1', '릴리스 노트 v1')
    const r = await searchService.search('ws-1', '릴리스', ALL)
    expect(r.results.map((h) => h.id)).toEqual(['n-1'])
  })
})

describe('keyword 검색 — 제목 일치 우선 정렬 (pdf/image 포함)', () => {
  it('제목이 일치하는 pdf 가 본문만 일치하는 노트들보다 앞에 온다', async () => {
    for (let i = 1; i <= 12; i++) {
      note(`n-${i}`, `노트 ${i}`)
      fts('note', `n-${i}`, `노트 ${i}\n계약서 관련 언급`)
    }
    pdf('p-1', '계약서 최종본')
    const r = await searchService.search('ws-1', '계약서', ALL)
    expect(r.results[0]).toMatchObject({ type: 'pdf', id: 'p-1', matchType: 'title' })
    expect(r.results.slice(0, 10).some((h) => h.type === 'pdf')).toBe(true)
    expect(r.meta.perTypeCounts).toMatchObject({ note: 12, pdf: 1 })
  })

  it('제목 일치끼리는 점수(FTS) → 최신순, 본문 일치는 그 뒤', async () => {
    note('n-old', '계약서 초안', 'ws-1', new Date('2026-01-01T00:00:00Z'))
    note('n-new', '계약서 수정본', 'ws-1', new Date('2026-08-01T00:00:00Z'))
    note('n-body', '메모', 'ws-1', new Date('2026-09-01T00:00:00Z'))
    fts('note', 'n-old', '계약서 초안')
    fts('note', 'n-new', '계약서 수정본')
    fts('note', 'n-body', '메모\n계약서 얘기')
    const r = await searchService.search('ws-1', '계약서', ALL)
    const ids = r.results.map((h) => h.id)
    expect(ids.indexOf('n-body')).toBe(2)
    expect(new Set(ids.slice(0, 2))).toEqual(new Set(['n-old', 'n-new']))
  })
})

describe('embedding — 임베딩 실패와 무관하게 FTS 는 기록된다', () => {
  it('embed 가 throw 해도 search_fts 행이 생기고 에러는 전파된다', async () => {
    note('n-1', '오프라인 노트')
    vi.mocked(embed).mockRejectedValue(new Error('model unavailable'))
    await expect(embeddingService.syncNow('note', 'n-1')).rejects.toThrow('model unavailable')
    const rows = sqlite
      .prepare('SELECT entity_id AS id FROM search_fts WHERE entity_type = ?')
      .all('note') as { id: string }[]
    expect(rows.map((r) => r.id)).toEqual(['n-1'])
    const r = await searchService.search('ws-1', '오프라인', ALL)
    expect(r.results.map((h) => h.id)).toEqual(['n-1'])
  })

  it('모델을 못 받으면 백필이 FTS-only 로 전체 엔티티를 덮는다', async () => {
    note('n-1', '첫 노트')
    note('n-2', '둘째 노트')
    fts('note', 'n-1', '첫 노트 이미 색인됨')
    vi.mocked(ensureModel).mockRejectedValue(new Error('download failed'))
    await embeddingService.backfillAll()
    expect(embed).not.toHaveBeenCalled()
    const rows = sqlite
      .prepare('SELECT entity_id AS id, text FROM search_fts WHERE entity_type = ? ORDER BY id')
      .all('note') as { id: string; text: string }[]
    expect(rows.map((r) => r.id)).toEqual(['n-1', 'n-2'])
    expect(rows[0].text).toContain('이미 색인됨') // 기존 행은 건드리지 않음
    expect((await searchService.search('ws-1', '둘째', ALL)).results.map((h) => h.id)).toEqual([
      'n-2'
    ])
  })
})

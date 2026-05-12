/**
 * CHANGELOG 데이터 무결성 단위 테스트.
 *
 * P2-6 — shared/constants 에서 entities/changelog 로 이전 후 콘텐츠 회귀 차단.
 */
import { describe, it, expect } from 'vitest'
import { CHANGELOG } from '../data'

const SEMVER_RE = /^\d+\.\d+\.\d+$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function compareVersions(a: string, b: string): number {
  const [aMaj, aMin, aPatch] = a.split('.').map(Number)
  const [bMaj, bMin, bPatch] = b.split('.').map(Number)
  if (aMaj !== bMaj) return aMaj - bMaj
  if (aMin !== bMin) return aMin - bMin
  return aPatch - bPatch
}

describe('CHANGELOG 데이터 무결성', () => {
  it('비어 있지 않다', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0)
  })

  it('모든 entry 의 version 이 semver 형식', () => {
    for (const entry of CHANGELOG) {
      expect(entry.version, `invalid semver: ${entry.version}`).toMatch(SEMVER_RE)
    }
  })

  it('모든 entry 의 date 가 ISO YYYY-MM-DD 형식', () => {
    for (const entry of CHANGELOG) {
      expect(entry.date, `invalid date: ${entry.date}`).toMatch(ISO_DATE_RE)
    }
  })

  it('모든 entry 가 1개 이상의 변경사항을 갖는다', () => {
    for (const entry of CHANGELOG) {
      expect(entry.changes.length, `${entry.version} has 0 changes`).toBeGreaterThan(0)
    }
  })

  it('변경사항의 type 은 feature / improvement / fix 중 하나', () => {
    const allowed = new Set(['feature', 'improvement', 'fix'])
    for (const entry of CHANGELOG) {
      for (const change of entry.changes) {
        expect(allowed.has(change.type), `${entry.version}: invalid type ${change.type}`).toBe(true)
        expect(change.title.length, `${entry.version}: empty title`).toBeGreaterThan(0)
      }
    }
  })

  it('version 은 고유하다 (중복 금지)', () => {
    const versions = CHANGELOG.map((e) => e.version)
    expect(new Set(versions).size).toBe(versions.length)
  })

  it('version 이 strictly decreasing 순서로 정렬됨 (최신이 맨 위)', () => {
    for (let i = 0; i < CHANGELOG.length - 1; i++) {
      const cmp = compareVersions(CHANGELOG[i].version, CHANGELOG[i + 1].version)
      expect(
        cmp,
        `versions out of order: ${CHANGELOG[i].version} should be > ${CHANGELOG[i + 1].version}`
      ).toBeGreaterThan(0)
    }
  })
})

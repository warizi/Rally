/**
 * fileTypeConfigs 확장자 매칭/타이틀 추출 회귀 테스트.
 *
 * Windows에서 흔한 대문자 확장자(NOTE.MD, DATA.CSV, 문서.PDF)가
 * reconcile/watch 경로에서 누락되지 않는지 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { fileTypeConfigs } from '../file-type-config'

function configOf(entityType: string): (typeof fileTypeConfigs)[number] {
  const config = fileTypeConfigs.find((c) => c.entityType === entityType)
  if (!config) throw new Error(`config not found: ${entityType}`)
  return config
}

describe('fileTypeConfigs — 대소문자 무시 확장자 매칭', () => {
  it('md — NOTE.MD 매칭 + title NOTE', () => {
    const md = configOf('note')
    expect(md.matchExtension('NOTE.MD')).toBe(true)
    expect(md.matchExtension('note.md')).toBe(true)
    expect(md.matchExtension('note.mdx')).toBe(false)
    expect(md.extractTitle('NOTE.MD')).toBe('NOTE')
  })

  it('csv — /tmp/DATA.CSV 매칭 + title DATA', () => {
    const csv = configOf('csv')
    expect(csv.matchExtension('/tmp/DATA.CSV')).toBe(true)
    expect(csv.extractTitle('/tmp/DATA.CSV')).toBe('DATA')
  })

  it('pdf — 문서.PDF 매칭 + title 문서', () => {
    const pdf = configOf('pdf')
    expect(pdf.matchExtension('문서.PDF')).toBe(true)
    expect(pdf.extractTitle('문서.PDF')).toBe('문서')
  })

  it('image — PIC.PNG 매칭 (기존 동작 유지)', () => {
    const image = configOf('image')
    expect(image.matchExtension('PIC.PNG')).toBe(true)
    expect(image.extractTitle('PIC.PNG')).toBe('PIC')
  })
})

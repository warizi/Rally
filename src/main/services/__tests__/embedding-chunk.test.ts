import { describe, it, expect } from 'vitest'
import { chunkNote, composeShortText } from '../embedding-chunk'

describe('chunkNote', () => {
  it('제목만 있고 본문 비면 제목 청크 1개', () => {
    const chunks = chunkNote('내 노트', '')
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual({ index: 0, text: '내 노트' })
  })

  it('제목·본문 모두 비면 빈 배열', () => {
    expect(chunkNote('', '')).toEqual([])
    expect(chunkNote('   ', '   ')).toEqual([])
  })

  it('heading 없는 본문 → 제목 부스팅된 단일 청크', () => {
    const chunks = chunkNote('강아지', '오늘 산책했다.')
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toBe('[강아지] 오늘 산책했다.')
    expect(chunks[0].index).toBe(0)
  })

  it('heading 경계로 섹션 분할 + 상위 heading 경로 prepend', () => {
    const md = ['# 개요', '첫 문단', '## 세부', '둘째 문단'].join('\n')
    const chunks = chunkNote('문서', md)
    expect(chunks).toHaveLength(2)
    expect(chunks[0].text).toBe('[문서 > 개요] 첫 문단')
    // 중첩 heading 경로 (h1 > h2)
    expect(chunks[1].text).toBe('[문서 > 개요 > 세부] 둘째 문단')
  })

  it('같은/얕은 레벨 heading 은 스택에서 pop 되어 경로가 갱신된다', () => {
    const md = ['# A', '본문a', '# B', '본문b'].join('\n')
    const chunks = chunkNote('T', md)
    expect(chunks).toHaveLength(2)
    expect(chunks[0].text).toBe('[T > A] 본문a')
    expect(chunks[1].text).toBe('[T > B] 본문b') // A 가 pop, B 로 교체
  })

  it('Rally 임베드 구문 ![[...]] 은 노이즈로 제거', () => {
    const chunks = chunkNote('N', '앞 ![[note:abc123]] 뒤')
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).not.toContain('![[')
    expect(chunks[0].text).toContain('앞')
    expect(chunks[0].text).toContain('뒤')
  })

  it('긴 본문은 문단 단위로 여러 청크로 분할 (MAX_CHARS 초과)', () => {
    const para = 'A'.repeat(700)
    const chunks = chunkNote('', `${para}\n\n${para}\n\n${para}`)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(1200)
    // index 가 0..n 순차
    chunks.forEach((c, i) => expect(c.index).toBe(i))
  })

  it('단일 문단이 상한 초과 시 강제로 잘라 넣는다', () => {
    const huge = 'B'.repeat(2500) // \n\n 없는 단일 문단
    const chunks = chunkNote('', huge)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(1200)
  })
})

describe('composeShortText', () => {
  it('null/undefined/공백 필드를 제외하고 \\n 으로 합친다', () => {
    expect(composeShortText(['제목', null, undefined, '  ', '설명'])).toBe('제목\n설명')
  })

  it('모든 필드가 비면 빈 문자열', () => {
    expect(composeShortText([null, undefined, '   ', ''])).toBe('')
  })

  it('각 필드 trim 적용', () => {
    expect(composeShortText(['  a  ', ' b '])).toBe('a\nb')
  })
})

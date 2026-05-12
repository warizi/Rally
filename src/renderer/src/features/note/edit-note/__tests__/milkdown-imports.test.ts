/**
 * Milkdown 의존성 정리 회귀 차단 테스트.
 *
 * 성능-1 Phase 2 — `@milkdown/core`, `@milkdown/plugin-listener`,
 * `@milkdown/preset-commonmark`, `@milkdown/theme-nord` 4개 패키지를 제거하고
 * `@milkdown/kit/*` 서브패스로 통일했다. 향후 누군가 다시 별도 패키지를
 * 추가하지 않도록 정적 검증.
 *
 * Milkdown 자체 동작은 prosemirror 가 happy-dom 환경에서 측정 불안정 →
 * 통합 동작은 수동 검증 (Phase 4 의 FCP 측정 + 실제 노트 편집 사용 확인).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// vitest 가 repo root 에서 실행되므로 cwd 사용.
const repoRoot = process.cwd()

function readPackageJson(): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8'))
}

function readSource(relPath: string): string {
  return readFileSync(resolve(repoRoot, relPath), 'utf-8')
}

describe('Milkdown 의존성 화이트리스트', () => {
  it('package.json 에 @milkdown 패키지는 kit / react 만 등록되어 있다', () => {
    const pkg = readPackageJson()
    const deps = (pkg.dependencies as Record<string, string>) ?? {}
    const milkdownPkgs = Object.keys(deps).filter((d) => d.startsWith('@milkdown/'))
    expect(milkdownPkgs.sort()).toEqual(['@milkdown/kit', '@milkdown/react'])
  })

  it('renderer 소스에 제거된 패키지 import 가 남아 있지 않다', () => {
    const removed = [
      '@milkdown/core',
      '@milkdown/plugin-listener',
      '@milkdown/preset-commonmark',
      '@milkdown/theme-nord'
    ]
    const files = [
      'src/renderer/src/features/note/edit-note/ui/NoteEditor.tsx',
      'src/renderer/src/features/note/edit-note/ui/NoteSearchBar.tsx',
      'src/renderer/src/features/note/edit-note/model/note-image-node-view.ts',
      'src/renderer/src/features/note/edit-note/model/note-link-input-rule.ts',
      'src/renderer/src/features/note/edit-note/model/note-search-plugin.ts',
      'src/renderer/src/features/note/edit-note/model/note-syntax-hint-plugin.ts'
    ]
    for (const file of files) {
      const src = readSource(file)
      for (const pkg of removed) {
        const re = new RegExp(`from\\s+['"\`]${pkg}(/|['"\`])`, 'g')
        const matches = src.match(re)
        expect(matches, `${file} should not import "${pkg}"`).toBeNull()
      }
    }
  })

  it('NoteEditor / NoteSearchBar 핵심 export 가 @milkdown/kit/core 에서 import 된다', () => {
    const editor = readSource('src/renderer/src/features/note/edit-note/ui/NoteEditor.tsx')
    expect(editor).toMatch(/from\s+['"]@milkdown\/kit\/core['"]/)

    const searchBar = readSource('src/renderer/src/features/note/edit-note/ui/NoteSearchBar.tsx')
    expect(searchBar).toMatch(/from\s+['"]@milkdown\/kit\/core['"]/)
  })
})

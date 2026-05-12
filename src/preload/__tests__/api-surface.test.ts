/**
 * preload api-surface 정적 검증.
 *
 * sandbox=true 전환 전에 preload 의 보안 표면적이 의도된 형태를 유지하는지를
 * 소스 파일 텍스트 분석으로 회귀 차단. Electron 환경 모킹 없이 동작.
 *
 * 보안-1 Phase 2.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(__dirname, '../../..')

function readSource(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf-8')
}

describe('preload api-surface', () => {
  it('exposeInMainWorld 는 화이트리스트 (api / electron / shell) 만 등록한다', () => {
    const src = readSource('src/preload/index.ts')
    const exposed = [...src.matchAll(/exposeInMainWorld\(['"](\w+)['"]/g)].map((m) => m[1])
    expect(exposed.sort()).toEqual(['api', 'electron', 'shell'])
  })

  it('process.contextIsolated 분기가 존재한다 (legacy non-isolated fallback 보호)', () => {
    const src = readSource('src/preload/index.ts')
    expect(src).toMatch(/process\.contextIsolated/)
  })

  it('preload 소스 어디서도 native Node 모듈을 import 하지 않는다', () => {
    // sandbox=true 호환을 위해 fs / path / os / child_process / node-pty 등 사용 금지.
    // ipcRenderer + electron-toolkit/preload 만 허용.
    const forbidden = ['fs', 'path', 'os', 'child_process', 'node-pty', 'crypto', 'http', 'https']
    const allFiles = [
      'src/preload/index.ts',
      'src/preload/apis/app-info.ts',
      'src/preload/apis/backup.ts',
      'src/preload/apis/canvas.ts',
      'src/preload/apis/csv.ts',
      'src/preload/apis/folder.ts',
      'src/preload/apis/index.ts',
      'src/preload/apis/note.ts',
      'src/preload/apis/pdf.ts',
      'src/preload/apis/image.ts',
      'src/preload/apis/schedule.ts',
      'src/preload/apis/terminal.ts',
      'src/preload/apis/todo.ts',
      'src/preload/apis/workspace.ts',
      'src/preload/lib/terminal-listeners.ts',
      'src/preload/lib/on-changed-listener.ts'
    ]
    for (const file of allFiles) {
      const src = readSource(file)
      for (const mod of forbidden) {
        const re = new RegExp(`(?:import|require\\()\\s*[^'"\`]*['"\`]${mod}['"\`]`, 'g')
        const matches = src.match(re)
        expect(matches, `${file} should not import "${mod}"`).toBeNull()
      }
    }
  })

  it('preload 의 외부 import 는 electron 과 @electron-toolkit/preload 만 사용한다', () => {
    const src = readSource('src/preload/index.ts')
    const externalImports = [...src.matchAll(/^import[^'"]+from\s+['"]([^'".][^'"]*)['"]/gm)].map(
      (m) => m[1]
    )
    const allowedExternals = new Set(['electron', '@electron-toolkit/preload'])
    const unexpected = externalImports.filter((mod) => !allowedExternals.has(mod))
    expect(unexpected).toEqual([])
  })

  it('electronAPI / api / shell 만 exposeInMainWorld 의 첫 인자에 등장한다', () => {
    // 비정상 추가 차단 (예: 누군가 fs API 직접 노출 시도)
    const src = readSource('src/preload/index.ts')
    const calls = [...src.matchAll(/contextBridge\.exposeInMainWorld\(['"](\w+)['"],\s*(\w+)/g)]
    expect(calls.length).toBe(3)
    const variableNames = calls.map((m) => m[2]).sort()
    expect(variableNames).toEqual(['api', 'electronAPI', 'shellApi'])
  })
})

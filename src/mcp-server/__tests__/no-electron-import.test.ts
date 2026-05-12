/**
 * mcp-server 소스에 electron 모듈 import 가 없는지 정적 검증.
 *
 * 배포-1: ELECTRON_RUN_AS_NODE 모드의 child process 에서 dist-mcp 가 동작.
 * 이 모드에서는 GUI 관련 Electron API 가 비활성화되므로 electron 모듈을
 * import 하면 런타임 에러 또는 의도치 않은 동작. 정적으로 차단.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MCP_SERVER_DIR = join(process.cwd(), 'src/mcp-server')

function walkTsFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      files.push(...walkTsFiles(full))
    } else if (entry.endsWith('.ts')) {
      files.push(full)
    }
  }
  return files
}

describe('S4 — mcp-server electron import 정적 차단', () => {
  const sources = walkTsFiles(MCP_SERVER_DIR)

  it('mcp-server 소스 디렉토리에 1개 이상의 ts 파일 존재 (sanity check)', () => {
    expect(sources.length).toBeGreaterThan(0)
  })

  it('어떤 ts 파일도 electron 모듈을 import 하지 않는다', () => {
    for (const file of sources) {
      const src = readFileSync(file, 'utf-8')
      expect(src, `${file}: \`from 'electron'\` 금지`).not.toMatch(/from\s+['"]electron['"]/)
      expect(src, `${file}: \`require('electron')\` 금지`).not.toMatch(
        /require\(\s*['"]electron['"]\s*\)/
      )
    }
  })

  it('어떤 ts 파일도 process.execPath 를 사용하지 않는다 (ELECTRON_RUN_AS_NODE 모드에서 의미 달라짐)', () => {
    for (const file of sources) {
      const src = readFileSync(file, 'utf-8')
      expect(src, `${file}: process.execPath 사용 금지`).not.toMatch(/process\.execPath/)
    }
  })
})

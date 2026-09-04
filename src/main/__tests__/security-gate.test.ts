/**
 * scripts/security-gate.mjs — Electron 보안 스캔 CI 게이트의 판정 로직.
 *
 * 스크립트를 서브프로세스로 실행하고 `--input` 으로 electronegativity issue 배열(JSON) 픽스처를 주입한다.
 * (scripts/ 는 tsconfig 밖이라 직접 import 하지 않는다.)
 *
 * 고정하는 규칙:
 *   - HIGH + CERTAIN/FIRM/TENTATIVE → exit 1
 *   - MEDIUM/LOW/INFORMATIONAL 만 → exit 0 (기준 상태는 MEDIUM 6건 안팎)
 *   - --threshold=medium 이면 MEDIUM 도 차단
 *   - 입력 모양이 기대와 다르면 exit 2 (포맷 변경이 조용히 0 으로 통과하지 않도록)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SCRIPT = path.resolve(process.cwd(), 'scripts/security-gate.mjs')

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-security-gate-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

interface Issue {
  id: string
  severity: { name: string }
  confidence: { name: string }
  file?: string
  location?: { line: number; column: number }
  description?: string
}

function issue(id: string, severity: string, confidence: string, file?: string): Issue {
  return {
    id,
    severity: { name: severity },
    confidence: { name: confidence },
    file,
    location: { line: 1, column: 0 },
    description: `desc of ${id}`
  }
}

function fixture(data: unknown): string {
  const p = path.join(dir, 'issues.json')
  fs.writeFileSync(p, JSON.stringify(data))
  return p
}

function run(input: string, extra: string[] = []): { code: number; out: string } {
  const res = spawnSync(process.execPath, [SCRIPT, `--input=${input}`, ...extra], {
    encoding: 'utf-8'
  })
  return { code: res.status ?? -1, out: res.stdout + res.stderr }
}

const BASELINE = [
  issue('CSP_GLOBAL_CHECK', 'MEDIUM', 'CERTAIN'),
  issue('PERMISSION_REQUEST_HANDLER_GLOBAL_CHECK', 'MEDIUM', 'CERTAIN'),
  issue('AUXCLICK_JS_CHECK', 'MEDIUM', 'FIRM', 'src/main/bootstrap/main-window.ts')
]

describe('security-gate — 판정', () => {
  it('기준 상태(MEDIUM 만)는 통과', () => {
    const r = run(fixture(BASELINE))
    expect(r.code, r.out).toBe(0)
    expect(r.out).toContain('passed')
    expect(r.out).toContain('3 below threshold')
  })

  it('finding 이 없어도 통과', () => {
    const r = run(fixture([]))
    expect(r.code, r.out).toBe(0)
  })

  it.each([['CERTAIN'], ['FIRM'], ['TENTATIVE']])('HIGH / %s 은 차단', (conf) => {
    const r = run(
      fixture([
        ...BASELINE,
        issue('CONTEXT_ISOLATION_JS_CHECK', 'HIGH', conf, 'src/main/bootstrap/main-window.ts')
      ])
    )
    expect(r.code, r.out).toBe(1)
    expect(r.out).toContain('CONTEXT_ISOLATION_JS_CHECK')
    expect(r.out).toContain('FAILED')
  })

  it('--threshold=medium 이면 기준 상태의 MEDIUM 도 차단', () => {
    const r = run(fixture(BASELINE), ['--threshold=medium'])
    expect(r.code, r.out).toBe(1)
  })

  it('입력 모양이 기대와 다르면 exit 2 — 포맷 변경이 조용히 통과하지 않는다', () => {
    const r = run(fixture([{ check: 'X', level: 'error' }]))
    expect(r.code, r.out).toBe(2)
    expect(r.out).toContain('malformed issue')
  })

  it('입력이 배열이 아니면 exit 2', () => {
    const r = run(fixture({ issues: [] }))
    expect(r.code, r.out).toBe(2)
  })

  it('알 수 없는 threshold 는 exit 2', () => {
    const r = run(fixture(BASELINE), ['--threshold=extreme'])
    expect(r.code, r.out).toBe(2)
  })
})

describe('security-gate — 리포지토리 배선', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8')) as {
    scripts: Record<string, string>
  }
  const workflow = fs.readFileSync(
    path.resolve(process.cwd(), '.github/workflows/test.yml'),
    'utf-8'
  )
  const script = fs.readFileSync(SCRIPT, 'utf-8')

  it('package.json 에 security:gate 스크립트 존재', () => {
    expect(pkg.scripts['security:gate']).toMatch(/security-gate\.mjs/)
  })

  it('test.yml 의 security-scan job 이 텍스트 grep 이 아니라 security:gate 를 실행한다', () => {
    expect(workflow).toMatch(/^\s{2}security-scan:$/m)
    expect(workflow).toMatch(/run: npm run security:gate$/m)
    expect(workflow).not.toMatch(/grep -cE 'HIGH/)
  })

  it('게이트는 src/main 과 src/preload 를 모두 스캔한다 (CLI -i 는 마지막 값만 쓰는 함정)', () => {
    expect(script).toMatch(/SCAN_INPUTS = \['src\/main', 'src\/preload'\]/)
  })

  it('CLI 스크립트는 -i 를 반복하지 않는다 (마지막 값만 적용되어 앞 입력이 조용히 빠진다)', () => {
    for (const [name, cmd] of Object.entries(pkg.scripts)) {
      if (!cmd.includes('electronegativity')) continue
      const inputs = cmd.match(/(^|\s)-i\s/g) ?? []
      expect(inputs.length, `${name}: ${cmd}`).toBeLessThanOrEqual(1)
    }
  })
})

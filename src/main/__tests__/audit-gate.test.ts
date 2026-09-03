/**
 * scripts/audit-gate.mjs — npm audit CI 게이트의 판정 로직.
 *
 * 스크립트를 서브프로세스로 실행하고 `--input` / `--allowlist` / `--today` 로 픽스처를 주입한다.
 * (scripts/ 는 tsconfig 밖이라 직접 import 하지 않는다.)
 *
 * 고정하는 규칙:
 *   - 임계값 이상 + allowlist 없음 → exit 1
 *   - allowlist 항목(사유+추가일+만료일) 있음 → exit 0
 *   - 만료된 allowlist → exit 1 (예외가 자동 무효화)
 *   - 사유 누락 / 만료일 누락 / 180일 초과 → exit 1 (영구 예외 차단)
 *   - advisory 를 지정하면 그 advisory 에만 한정
 *   - 임계값 미만 → exit 0
 *   - --report-only → 항상 exit 0
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SCRIPT = path.resolve(process.cwd(), 'scripts/audit-gate.mjs')
const TODAY = '2026-09-03'

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-audit-gate-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

type Vuln = {
  severity: 'info' | 'low' | 'moderate' | 'high' | 'critical'
  range?: string
  isDirect?: boolean
  fixAvailable?: boolean | { name: string; version: string; isSemVerMajor: boolean }
  via?: Array<string | { url: string; title?: string }>
}

function audit(vulns: Record<string, Vuln>): string {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 }
  for (const v of Object.values(vulns)) {
    counts[v.severity]++
    counts.total++
  }
  const p = path.join(dir, 'audit.json')
  fs.writeFileSync(
    p,
    JSON.stringify({
      auditReportVersion: 2,
      vulnerabilities: Object.fromEntries(
        Object.entries(vulns).map(([k, v]) => [
          k,
          { name: k, range: '*', isDirect: false, fixAvailable: false, via: [], ...v }
        ])
      ),
      metadata: { vulnerabilities: counts }
    })
  )
  return p
}

function allowlist(entries: unknown[]): string {
  const p = path.join(dir, 'allow.json')
  fs.writeFileSync(p, JSON.stringify({ entries }))
  return p
}

function run(
  auditPath: string,
  allowPath: string,
  extra: string[] = []
): { code: number; out: string } {
  const res = spawnSync(
    process.execPath,
    [SCRIPT, `--input=${auditPath}`, `--allowlist=${allowPath}`, `--today=${TODAY}`, ...extra],
    { encoding: 'utf-8' }
  )
  return { code: res.status ?? -1, out: res.stdout + res.stderr }
}

const HIGH = { severity: 'high', range: '<1.2.3' } as const
const VALID_ENTRY = {
  package: 'left-pad',
  reason: 'upstream fix pending, no forward path in current major',
  addedAt: '2026-09-01',
  expires: '2026-11-30'
}

describe('audit-gate — 차단 판정', () => {
  it('임계값 이상 취약점이 allowlist 없이 있으면 exit 1', () => {
    const r = run(audit({ 'left-pad': HIGH }), allowlist([]))
    expect(r.code, r.out).toBe(1)
    expect(r.out).toContain('left-pad')
    expect(r.out).toContain('FAILED')
  })

  it('critical 도 high 임계값에 걸린다', () => {
    const r = run(audit({ 'left-pad': { severity: 'critical' } }), allowlist([]))
    expect(r.code, r.out).toBe(1)
  })

  it('임계값 미만(moderate)만 있으면 exit 0', () => {
    const r = run(audit({ 'left-pad': { severity: 'moderate' } }), allowlist([]))
    expect(r.code, r.out).toBe(0)
    expect(r.out).toContain('below threshold')
  })

  it('--threshold=moderate 로 낮추면 moderate 도 차단', () => {
    const r = run(audit({ 'left-pad': { severity: 'moderate' } }), allowlist([]), [
      '--threshold=moderate'
    ])
    expect(r.code, r.out).toBe(1)
  })

  it('취약점이 없으면 exit 0', () => {
    const r = run(audit({}), allowlist([]))
    expect(r.code, r.out).toBe(0)
    expect(r.out).toContain('passed')
  })

  it('--report-only 는 차단 대상이 있어도 exit 0', () => {
    const r = run(audit({ 'left-pad': HIGH }), allowlist([]), ['--report-only'])
    expect(r.code, r.out).toBe(0)
    expect(r.out).toContain('report-only')
  })
})

describe('audit-gate — allowlist', () => {
  it('유효한 항목(사유+추가일+만료일)이면 통과하고 allowlisted 로 표기', () => {
    const r = run(audit({ 'left-pad': HIGH }), allowlist([VALID_ENTRY]))
    expect(r.code, r.out).toBe(0)
    expect(r.out).toContain('1 allowlisted')
    expect(r.out).toContain('until 2026-11-30')
  })

  it('만료된 항목은 예외로 인정하지 않는다 → exit 1', () => {
    const r = run(
      audit({ 'left-pad': HIGH }),
      allowlist([{ ...VALID_ENTRY, addedAt: '2026-03-01', expires: '2026-08-31' }])
    )
    expect(r.code, r.out).toBe(1)
    expect(r.out).toContain('EXPIRED 2026-08-31')
  })

  it('만료일 당일까지는 유효하다', () => {
    const r = run(
      audit({ 'left-pad': HIGH }),
      allowlist([{ ...VALID_ENTRY, addedAt: '2026-06-01', expires: TODAY }])
    )
    expect(r.code, r.out).toBe(0)
  })

  it('reason 누락 → exit 1 (취약점 없어도 allowlist 형식 오류는 실패)', () => {
    const { reason: _r, ...noReason } = VALID_ENTRY
    void _r
    const r = run(audit({}), allowlist([noReason]))
    expect(r.code, r.out).toBe(1)
    expect(r.out).toContain('"reason" required')
  })

  it('expires 누락 → exit 1', () => {
    const { expires: _e, ...noExpires } = VALID_ENTRY
    void _e
    const r = run(audit({}), allowlist([noExpires]))
    expect(r.code, r.out).toBe(1)
    expect(r.out).toContain('"expires" required')
  })

  it('addedAt 기준 180일 초과 유예 → exit 1 (영구 예외 차단)', () => {
    const r = run(
      audit({ 'left-pad': HIGH }),
      allowlist([{ ...VALID_ENTRY, addedAt: '2026-09-01', expires: '2027-09-01' }])
    )
    expect(r.code, r.out).toBe(1)
    expect(r.out).toContain('exceeds 180d')
  })

  it('advisory 를 지정하면 다른 advisory 의 같은 패키지는 차단', () => {
    const vuln: Vuln = {
      ...HIGH,
      via: [{ url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', title: 'x' }]
    }
    const matched = run(
      audit({ 'left-pad': vuln }),
      allowlist([{ ...VALID_ENTRY, advisory: 'GHSA-aaaa-bbbb-cccc' }])
    )
    expect(matched.code, matched.out).toBe(0)

    const mismatched = run(
      audit({ 'left-pad': vuln }),
      allowlist([{ ...VALID_ENTRY, advisory: 'GHSA-zzzz-zzzz-zzzz' }])
    )
    expect(mismatched.code, mismatched.out).toBe(1)
  })

  it('allowlist 는 매칭된 패키지만 덮는다 — 다른 패키지는 여전히 차단', () => {
    const r = run(audit({ 'left-pad': HIGH, 'right-pad': HIGH }), allowlist([VALID_ENTRY]))
    expect(r.code, r.out).toBe(1)
    expect(r.out).toContain('right-pad')
  })

  it('아무것도 매칭하지 않는 항목은 제거 안내를 낸다 (실패는 아님)', () => {
    const r = run(audit({}), allowlist([VALID_ENTRY]))
    expect(r.code, r.out).toBe(0)
    expect(r.out).toContain('no longer match')
  })
})

describe('audit-gate — 리포지토리 배선', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8')) as {
    scripts: Record<string, string>
  }
  const workflow = fs.readFileSync(
    path.resolve(process.cwd(), '.github/workflows/test.yml'),
    'utf-8'
  )

  it('package.json 의 audit:gate 는 dev 까지 포함하고 report-only 가 아니다', () => {
    expect(pkg.scripts['audit:gate']).toMatch(/audit-gate\.mjs/)
    expect(pkg.scripts['audit:gate']).toMatch(/--include-dev/)
    expect(pkg.scripts['audit:gate']).not.toMatch(/--report-only/)
    // prod 만 따로 볼 때 쓰는 보조 스크립트 — 게이트가 아니다
    expect(pkg.scripts['audit:gate:prod']).toMatch(/audit-gate\.mjs/)
    expect(pkg.scripts['audit:gate:prod']).not.toMatch(/--include-dev/)
  })

  it('test.yml 의 dependency-audit job 이 prod + dev 게이트를 차단 모드로 실행한다', () => {
    expect(workflow).toMatch(/^\s{2}dependency-audit:$/m)
    expect(workflow).toMatch(/run: npm run audit:gate$/m)
    // report-only 단계가 남아 있으면 승격이 되돌아간 것
    expect(workflow).not.toMatch(/run: .*--report-only/)
    expect(workflow).not.toMatch(/audit:gate:dev/)
  })

  it('.audit-allowlist.json 이 파싱 가능하고 entries 배열을 가진다', () => {
    const raw = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), '.audit-allowlist.json'), 'utf-8')
    ) as { entries: unknown[] }
    expect(Array.isArray(raw.entries)).toBe(true)
  })
})

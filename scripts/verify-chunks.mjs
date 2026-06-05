#!/usr/bin/env node
/**
 * 빌드 산출물에 예상 청크가 모두 분리되어 있는지 검증.
 *
 * 성능-1 Phase 3 — manualChunks 가 잘못 변경되어 vendor 라이브러리가 다시
 * 메인 청크에 합쳐지면 회귀로 차단한다.
 *
 * 호출 위치: CI test.yml. 빌드 후 실행.
 */
import { readdirSync } from 'node:fs'

const ASSETS_DIR = 'out/renderer/assets'

// manualChunks 의 key 이름이 파일명에 들어감 (vite 의 chunk 명명 규칙).
const EXPECTED_CHUNKS = [
  'xyflow',
  'react-pdf',
  'xterm',
  'recharts',
  'milkdown',
  'dnd-kit',
  'framer-motion',
  // 노트/코드 편집기 스택 — 메인 청크에서 분리되어 lazy 로드되는지 회귀 검증.
  'codemirror',
  'prosemirror'
]

function main() {
  let files
  try {
    files = readdirSync(ASSETS_DIR)
  } catch {
    console.error(`❌ ${ASSETS_DIR} 디렉토리가 없습니다. 먼저 \`npm run build\` 실행.`)
    process.exit(1)
  }

  const missing = []
  for (const chunkName of EXPECTED_CHUNKS) {
    const found = files.find((f) => f.startsWith(`${chunkName}-`) && f.endsWith('.js'))
    if (!found) {
      missing.push(chunkName)
    } else {
      console.log(`✅ ${chunkName} → ${found}`)
    }
  }

  if (missing.length > 0) {
    console.error(`\n❌ 누락된 청크: ${missing.join(', ')}`)
    console.error('manualChunks 설정 또는 의존성이 변경되었을 수 있습니다.')
    process.exit(1)
  }

  console.log(`\n✅ 모든 ${EXPECTED_CHUNKS.length}개 청크가 정상 분리됨.`)
}

main()

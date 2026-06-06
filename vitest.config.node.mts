import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/main/**/*.{test,spec}.{ts,mts}',
      'src/preload/**/*.{test,spec}.{ts,mts}',
      'src/mcp-server/**/*.{test,spec}.{ts,mts}'
    ],
    setupFiles: ['./src/main/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage/node',
      include: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
        '**/*.d.ts',
        '**/db/migrations/**',
        '**/types.ts',
        'src/main/index.ts',
        // 앱 부트스트랩 orchestration 모듈 — 런타임(앱 시작) 코드라 단위 테스트 대상이 아니다.
        // 보안/navigation 정책은 window-security.test 가 소스 스캔으로, 동작은 build 가 검증한다.
        'src/main/bootstrap/**',
        'src/main/services/onboarding-sample.ts',
        // 임베딩 파이프라인 런타임 모듈 — onnxruntime/Electron utilityProcess/net.fetch/sqlite-vec 에
        // 의존해 단위 테스트 환경(better-sqlite3 only)에서 실행 불가. dev e2e + 프로덕션 빌드로 검증.
        // 순수 로직(embedding-chunk)·상수(embedding-config)는 단위 테스트 유지.
        'src/main/services/embedding.ts',
        'src/main/services/embedding-model.ts',
        'src/main/services/embedding-worker.ts',
        'src/main/services/model-bootstrap.ts',
        'src/main/lib/embedding-progress.ts',
        // 하이브리드 검색 — 벡터 KNN/그래프 경로가 sqlite-vec 네이티브 확장 의존이라 단위 환경
        // (better-sqlite3 only, vecEnabled=false)에서 실행 불가. legacy 폴백은 search.test 가 검증,
        // 하이브리드 동작은 dev e2e + 프로덕션 빌드로 검증.
        'src/main/services/search.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 70,
        statements: 78
      }
    }
  }
})

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
        'src/main/services/onboarding-sample.ts'
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

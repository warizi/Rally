import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/renderer/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/renderer/src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage/web',
      include: ['src/renderer/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/__tests__/**',
        '**/*.d.ts',
        'src/renderer/src/test/**',
        'src/renderer/src/app/main.tsx',
        'src/renderer/src/shared/ui/**',
        'src/renderer/src/**/index.ts'
      ],
      // 샤딩된 coverage 실행(blob)에서는 부분 커버리지라 threshold 를 끈다.
      // 임계값은 머지된 리포트(coverage-web-merge job)에서만 평가한다.
      thresholds: process.env.VITEST_SKIP_THRESHOLDS
        ? undefined
        : {
            lines: 75,
            functions: 73,
            branches: 66,
            statements: 73
          }
    }
  },
  resolve: {
    alias: {
      '@': resolve('src/renderer/src'),
      '@app': resolve('src/renderer/src/app'),
      '@pages': resolve('src/renderer/src/pages'),
      '@widgets': resolve('src/renderer/src/widgets'),
      '@features': resolve('src/renderer/src/features'),
      '@entities': resolve('src/renderer/src/entities'),
      '@shared': resolve('src/renderer/src/shared')
    }
  }
})

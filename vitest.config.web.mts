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
      thresholds: {
        lines: 43,
        functions: 40,
        branches: 33,
        statements: 42
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

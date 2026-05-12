import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.{test,spec}.{ts,mts}'],
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
        'src/main/index.ts'
      ]
    }
  }
})

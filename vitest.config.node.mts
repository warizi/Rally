import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.{test,spec}.{ts,mts}'],
    setupFiles: ['./src/main/__tests__/setup.ts']
  }
})

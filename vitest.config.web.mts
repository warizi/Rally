import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    include: ['src/renderer/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/renderer/src/test/setup.ts']
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

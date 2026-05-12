import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import type { Plugin } from 'vite'

// `ANALYZE=1 npm run build` 로만 활성화. 일반 빌드에는 영향 없음.
const ANALYZE = process.env.ANALYZE === '1'

export default defineConfig({
  main: {},
  preload: {
    // 보안-1: sandbox: true 모드에서는 preload 가 외부 npm 모듈을 require() 할 수 없으므로
    // electron 내장 모듈만 external 로 두고 npm 의존성(@electron-toolkit/preload 등)은
    // 번들에 포함시킨다.
    plugins: [externalizeDepsPlugin({ exclude: ['@electron-toolkit/preload'] })]
  },
  renderer: {
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
    },
    plugins: [
      react(),
      tailwindcss(),
      // 성능-1: 번들 분석. `ANALYZE=1 npm run build` 시 dist/stats.html 생성.
      ANALYZE &&
        (visualizer({
          filename: 'dist/stats.html',
          gzipSize: true,
          brotliSize: true,
          template: 'treemap',
          open: false
        }) as unknown as Plugin)
    ].filter(Boolean) as Plugin[],
    build: {
      // 성능-1 Phase 3: 무거운 vendor 라이브러리를 별도 청크로 분리해 메인 청크
      // 비대화를 방지하고 라우트 lazy 효과를 극대화.
      rollupOptions: {
        output: {
          manualChunks: {
            xyflow: ['@xyflow/react'],
            'react-pdf': ['react-pdf'],
            xterm: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-serialize'],
            recharts: ['recharts'],
            milkdown: ['@milkdown/kit', '@milkdown/react'],
            'dnd-kit': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/modifiers'],
            'framer-motion': ['framer-motion']
          }
        }
      }
    }
  }
})

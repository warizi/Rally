import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import type { Plugin } from 'vite'

// `ANALYZE=1 npm run build` 로만 활성화. 일반 빌드에는 영향 없음.
const ANALYZE = process.env.ANALYZE === '1'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // 임베딩 추론은 별도 utilityProcess(embedding-worker)에서 실행 → 메인 번들과 분리 빌드.
        input: {
          index: resolve('src/main/index.ts'),
          'embedding-worker': resolve('src/main/services/embedding-worker.ts')
        },
        // native binary (@napi-rs/canvas) 와 그 wrapper(unpdf) 는 vite 가 chunk 로 묶지 않게
        // external 처리해 런타임에 node_modules 에서 직접 로드시킨다.
        // 묶으면 binary 파일/worker fallback resolve 가 깨진다.
        // @xenova/transformers + onnxruntime-node 도 동일 — 네이티브 바이너리/모델 파일
        // 동적 로드가 번들링되면 깨지므로 external 처리.
        external: ['@napi-rs/canvas', 'unpdf', '@xenova/transformers'],
        output: {
          // 워커 엔트리가 [name].js 로 떨어지도록 (utilityProcess.fork 경로 안정화)
          entryFileNames: '[name].js'
        }
      }
    }
  },
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
          // 무거운 vendor 는 별도 청크로 분리해 메인 청크 비대화를 막고 라우트 lazy 효과를
          // 극대화한다. 특히 노트/코드 편집기 스택(codemirror/lezer/prosemirror)은 lazy 경계
          // (설정 다이얼로그·노트 페이지) 뒤에서만 필요하므로 메인 청크에서 떼어낸다.
          // verify-chunks.mjs 가 이 청크들의 존재를 회귀로 검증한다.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (/[\\/]@xyflow[\\/]/.test(id)) return 'xyflow'
            if (/[\\/]react-pdf[\\/]/.test(id)) return 'react-pdf'
            if (/[\\/]@xterm[\\/]/.test(id)) return 'xterm'
            if (/[\\/]recharts[\\/]/.test(id)) return 'recharts'
            if (/[\\/]@milkdown[\\/]/.test(id)) return 'milkdown'
            if (/[\\/]@dnd-kit[\\/]/.test(id)) return 'dnd-kit'
            if (/[\\/]framer-motion[\\/]/.test(id)) return 'framer-motion'
            if (/[\\/](@codemirror|@lezer|@uiw[\\/]react-codemirror)[\\/]/.test(id)) {
              return 'codemirror'
            }
            if (/[\\/]prosemirror-[^\\/]+[\\/]/.test(id)) return 'prosemirror'
            return undefined
          }
        }
      }
    }
  }
})

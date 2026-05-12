import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
    plugins: [react(), tailwindcss()]
  }
})

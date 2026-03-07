import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/mcp-server/index.ts'],
  outDir: 'dist-mcp',
  format: ['cjs'],
  target: 'node18',
  clean: true,
  sourcemap: false,
  noExternal: [/.*/],
  banner: {
    js: '#!/usr/bin/env node'
  }
})

import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import boundaries from 'eslint-plugin-boundaries'

export default defineConfig(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/dist-mcp',
      '**/out',
      '**/coverage',
      'scripts/**',
      'src/renderer/src/shared/ui/**'
    ]
  },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['./tsconfig.web.json', './tsconfig.node.json']
        }
      },
      'boundaries/elements': [
        { type: 'app', pattern: 'src/renderer/src/app', mode: 'folder' },
        { type: 'pages', pattern: 'src/renderer/src/pages/*', mode: 'folder' },
        { type: 'widgets', pattern: 'src/renderer/src/widgets/*', mode: 'folder' },
        {
          type: 'features',
          pattern: 'src/renderer/src/features/*/*',
          mode: 'folder',
          capture: ['domain', 'action']
        },
        {
          type: 'entities',
          pattern: 'src/renderer/src/entities/*',
          mode: 'folder',
          capture: ['domain']
        },
        { type: 'shared', pattern: 'src/renderer/src/shared', mode: 'folder' }
      ]
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh,
      boundaries
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'app', allow: ['pages', 'widgets', 'features', 'entities', 'shared'] },
            { from: 'pages', allow: ['widgets', 'features', 'entities', 'shared'] },
            { from: 'widgets', allow: ['widgets', 'features', 'entities', 'shared'] },
            { from: 'features', allow: ['entities', 'shared'] },
            { from: 'entities', allow: ['shared'] },
            { from: 'shared', allow: [] }
          ]
        }
      ]
    }
  },
  eslintConfigPrettier
)

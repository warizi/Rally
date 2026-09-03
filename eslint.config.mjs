import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import boundaries from 'eslint-plugin-boundaries'

/** `from` 레이어가 `allowTo` 레이어들만 import 할 수 있다는 boundaries/dependencies 정책 하나. */
const fsdPolicy = (from, allowTo) => ({
  from: { element: { type: from } },
  allow: allowTo.map((type) => ({ to: { element: { type } } }))
})

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
      // eslint-plugin-boundaries v7 문법. `mode: 'folder'` 는 v7 기본값이라 제거했다 (명시하면 폐기 경고).
      // pattern 은 `**` 가 아니라 `*` 로 슬라이스 하나를 잡고 capture 로 이름을 뽑는다 — `**` 로 바꾸면
      // 하위 폴더마다 별도 element 로 잡혀 같은 슬라이스 내부 import 가 위반으로 오탐된다.
      'boundaries/elements': [
        { type: 'app', pattern: 'src/renderer/src/app' },
        { type: 'pages', pattern: 'src/renderer/src/pages/*' },
        { type: 'widgets', pattern: 'src/renderer/src/widgets/*' },
        {
          type: 'features',
          pattern: 'src/renderer/src/features/*/*',
          capture: ['domain', 'action']
        },
        { type: 'entities', pattern: 'src/renderer/src/entities/*', capture: ['domain'] },
        { type: 'shared', pattern: 'src/renderer/src/shared' }
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
      // React Compiler 를 쓰지 않으므로 "컴파일 건너뜀" 진단은 노이즈 (react-hooks 7.1+).
      'react-hooks/incompatible-library': 'off',
      // production code 에서 console.* 금지 — electron-log scoped logger 사용 강제.
      // bootstrap 영역 (preload/index.ts, mcp-server/index.ts) 은 inline disable 로 허용.
      // 테스트 파일은 아래 override 로 제외.
      'no-console': 'error',
      // `_` 접두사 변수/인자는 의도적 미사용 표식으로 허용 (destructure 제외 패턴 포함).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      // FSD 레이어 규칙: 각 레이어는 자기보다 아래 레이어만 import 할 수 있다 (widgets 는 widgets 끼리 허용).
      // v7: `element-types` → `dependencies`, `rules` → `policies`, 문자열 selector → entity selector.
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            fsdPolicy('app', ['pages', 'widgets', 'features', 'entities', 'shared']),
            fsdPolicy('pages', ['widgets', 'features', 'entities', 'shared']),
            fsdPolicy('widgets', ['widgets', 'features', 'entities', 'shared']),
            fsdPolicy('features', ['entities', 'shared']),
            fsdPolicy('entities', ['shared']),
            fsdPolicy('shared', [])
          ]
        }
      ]
    }
  },
  {
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      'no-console': 'off'
    }
  },
  eslintConfigPrettier
)

import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))

// ESLint 9 flat config for the Appendix A2 React console.
export default defineConfig(
  { ignores: ['dist'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: ROOT,
      },
    },
  },
)

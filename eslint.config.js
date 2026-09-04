import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))

// ESLint 9 flat config for the Spec-Ingest Tool.
export default defineConfig(
  // console-app/, console/, and tools/ are separate npm projects with their
  // own eslint.config.js and lint script -- don't lint them from here.
  { ignores: ['dist', 'console-app', 'console', 'tools'] },
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      globals: globals.node,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: ROOT,
      },
    },
    rules: {
      // Stub function signatures keep documented, unimplemented
      // parameters prefixed with `_` (see Spec-Ingest-Tool.md) rather
      // than deleting them -- allow that convention here.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['vitest.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
      parserOptions: {
        tsconfigRootDir: ROOT,
      },
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
)

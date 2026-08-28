import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// DEMO/REFERENCE SCAFFOLD -- ESLint 9 flat config for the Spec-Ingest Tool.
export default tseslint.config(
  // console-app/, console/, and tools/ are separate npm projects with their
  // own eslint.config.js and lint script -- don't lint them from here.
  { ignores: ['dist', 'console-app', 'console', 'tools'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      // Stub function signatures keep documented, unimplemented
      // parameters prefixed with `_` (see Spec-Ingest-Tool.md) rather
      // than deleting them -- allow that convention here.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
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

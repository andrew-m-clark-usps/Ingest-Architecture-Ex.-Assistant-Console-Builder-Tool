import js from '@eslint/js'
import globals from 'globals'

// DEMO/REFERENCE SCAFFOLD -- ESLint 9 flat config for the parity harness.
// twinning.mjs runs in Node but also passes callbacks into
// page.evaluate() that execute in a real browser (document, window),
// so both global sets are needed here.
export default [
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },
]

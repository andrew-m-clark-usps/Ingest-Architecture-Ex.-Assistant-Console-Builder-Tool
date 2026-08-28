import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// DEMO/REFERENCE SCAFFOLD -- ESLint 9 flat config for the Appendix A2 React console.
export default tseslint.config(
  { ignores: ['dist'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
)

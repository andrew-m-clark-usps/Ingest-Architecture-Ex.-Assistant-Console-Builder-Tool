import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'

// ESLint 9 flat config, per ../Console.md section 3.
export default defineConfig(
  { ignores: ['dist', 'test-results', 'playwright-report'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    // playwright.config.ts, the Playwright specs, and the MCP server
    // entry point run under Node, not the browser -- they need
    // `process`, not just DOM globals.
    files: ['playwright.config.ts', 'tests/**/*.ts', 'mcp/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
)

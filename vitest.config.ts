import { defineConfig } from 'vitest/config'

// Scope test discovery to this product's own src/ -- without this,
// vitest's default glob also picks up console-app/'s and other sibling
// projects' *.test.ts files, running them with the wrong cwd.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})

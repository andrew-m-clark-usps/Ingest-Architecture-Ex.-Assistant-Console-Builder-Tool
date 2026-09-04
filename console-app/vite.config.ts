import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// See ../Console.md section 3 (version traps): base must match wherever
// this is actually served from.
export default defineConfig({
  base: '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

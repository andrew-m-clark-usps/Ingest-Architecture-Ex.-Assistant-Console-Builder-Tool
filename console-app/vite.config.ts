import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// DEMO/REFERENCE SCAFFOLD -- see ../Console.md section 3 (version traps):
// base must match wherever this is actually served from.
export default defineConfig({
  base: '/',
  plugins: [react()],
})

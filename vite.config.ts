import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { aiPlugin } from './server/aiPlugin.ts'

export default defineConfig({
  plugins: [react(), aiPlugin()],
  server: { port: 5173, strictPort: false },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})

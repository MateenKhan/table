import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.tsx', 'src/columnDrag.test.ts', 'src/columnOrder.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
    css: { include: [/list\.css/] },
  },
})

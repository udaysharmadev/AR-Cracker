import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  build: { target: 'es2022', rollupOptions: { output: { manualChunks: { three: ['three'], react: ['react', 'react-dom', 'react-dom/client'] } } } },
});

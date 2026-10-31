import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  // Electron's dev launcher is intentionally pinned to this URL. Failing if
  // it is occupied prevents it from silently attaching to an older Vite app.
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { outDir: 'dist/renderer', emptyOutDir: true }
});

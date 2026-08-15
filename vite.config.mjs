import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: process.cwd(),
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});


import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

await build({
  configFile: false,
  root: process.cwd(),
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
      '@supabase/phoenix': resolve(process.cwd(), 'node_modules/@supabase/phoenix/priv/static/phoenix.cjs.js'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});

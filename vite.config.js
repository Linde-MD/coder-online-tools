import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

function normalizeBasePath(input) {
  const raw = String(input || '').trim();
  if (!raw) return '/';

  let base = raw;
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return base;
}

const pagesBase = normalizeBasePath(process.env.VITE_BASE_PATH || '/');

export default defineConfig({
  plugins: [vue()],
  base: pagesBase,
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://www.abc.com',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 8181,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
});

import { defineConfig } from 'vite';

/** Set VITE_BASE_PATH=/your-repo-name/ when deploying to a GitHub Pages project site. */
const base = process.env.VITE_BASE_PATH || './';

const gutenbergProxy = {
  target: 'https://www.gutenberg.org',
  changeOrigin: true,
  secure: true,
  rewrite: (path) => path.replace(/^\/api\/gutenberg/, '')
};

const madlibsProxy = {
  target: 'https://madlibs-api.vercel.app',
  changeOrigin: true,
  secure: true,
  rewrite: (path) => path.replace(/^\/api\/madlibs/, '')
};

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  base,
  server: {
    proxy: {
      '/api/gutenberg': gutenbergProxy,
      '/api/madlibs': madlibsProxy
    }
  },
  preview: {
    proxy: {
      '/api/gutenberg': gutenbergProxy,
      '/api/madlibs': madlibsProxy
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false
  }
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    root: __dirname,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        // `@react-pdf/renderer` references Node's `Buffer`; alias to the
        // browser polyfill so Vite resolves it correctly.
        buffer: 'buffer/',
      },
    },
    define: {
      // Expose Node-style globals that `@react-pdf/renderer` reaches for
      // at runtime in the browser. The actual Buffer instance is attached
      // to `globalThis` in `src/utils/pdf/styles.ts`.
      'globalThis.Buffer': 'globalThis.Buffer',
      global: 'globalThis',
    },
    optimizeDeps: {
      include: ['buffer', '@react-pdf/renderer'],
    },
    server: {      host: '127.0.0.1',      port: 5173,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: { ignored: ['**/tests/**', '**/test-results/**', '**/.git/**'] },
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3002',
          changeOrigin: true,
        },
        '/storage': {
          target: 'http://127.0.0.1:3002',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@react-pdf') || id.includes('pdfkit') || id.includes('fontkit') || id.includes('png-js')) {
                return 'vendor-pdf';
              }
              if (id.includes('xlsx')) {
                return 'vendor-xlsx';
              }
              if (id.includes('lucide-react') || id.includes('@radix-ui')) {
                return 'vendor-ui';
              }
              return 'vendor';
            }
          },
        },
      },
    },
  };
});

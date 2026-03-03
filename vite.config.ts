import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5180,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:5182',
            changeOrigin: true,
          },
        },
        watch: {
          ignored: ['**/assets/**', '**/output/**', '**/*.db', '**/*.db-wal', '**/*.db-shm'],
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY':                   JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY':            JSON.stringify(env.GEMINI_API_KEY),
        'process.env.TENSORAX_ANALYSIS_KEY':     JSON.stringify(env.TENSORAX_ANALYSIS_KEY   || ''),
        'process.env.TENSORAX_ANALYSIS_MODEL':   JSON.stringify(env.TENSORAX_ANALYSIS_MODEL || ''),
        'process.env.TENSORAX_COPY_KEY':         JSON.stringify(env.TENSORAX_COPY_KEY        || ''),
        'process.env.TENSORAX_COPY_MODEL':       JSON.stringify(env.TENSORAX_COPY_MODEL      || ''),
        'process.env.TENSORAX_IMAGE_KEY':        JSON.stringify(env.TENSORAX_IMAGE_KEY       || ''),
        'process.env.TENSORAX_IMAGE_MODEL':      JSON.stringify(env.TENSORAX_IMAGE_MODEL     || ''),
        'process.env.TENSORAX_KLING_KEY':        JSON.stringify(env.TENSORAX_KLING_KEY       || ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

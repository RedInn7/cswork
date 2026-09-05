import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  ssr: { noExternal: true, external: ['better-sqlite3', 'bullmq'] },
  build: {
    target: 'node22',
    ssr: 'lib/server/oj-worker.ts',
    outDir: 'dist/oj-worker',
    rollupOptions: {
      external: [
        'better-sqlite3',
        'bullmq',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: { entryFileNames: 'index.mjs' },
    },
  },
});

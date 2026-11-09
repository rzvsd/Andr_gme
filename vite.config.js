import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    // `npx cap sync android` rewrites android/.../assets/public while the dev server runs; watching
    // it crashed Vite on Windows (EBUSY). Generated output is never a source of HMR updates.
    watch: { ignored: ['**/android/**', '**/dist/**'] },
  },
  test: {
    // Worktrees under .claude/ carry their own tests/ copy; never run them twice.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});

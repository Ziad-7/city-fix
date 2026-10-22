import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: [
      // Stand-in for the React Native storage the shared usePrefs store persists through (same as tsconfig paths).
      { find: /^@react-native-async-storage\/async-storage$/, replacement: path.resolve(__dirname, './src/platform/async-storage.ts') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
});

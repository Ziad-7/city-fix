import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    // Same aliases as tsconfig.json: the shared mobile code keeps its @/domain, @/logic, @/utils imports.
    alias: [
      { find: /^@\/(domain|logic|utils|components)\//, replacement: `${src('shared')}/$1/` },
      { find: /^@\//, replacement: `${src('')}` },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});

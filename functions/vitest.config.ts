import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Admin SDK + gRPC are happier in separate processes.
    pool: 'forks',
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});

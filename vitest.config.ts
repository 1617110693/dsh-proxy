import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The plugin swaps process-wide transport state; keep files sequential.
    fileParallelism: false,
    testTimeout: 15_000,
  },
})

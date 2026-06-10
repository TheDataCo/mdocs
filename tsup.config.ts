import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  // Shebang so the published bin is directly executable.
  banner: { js: '#!/usr/bin/env node' },
})

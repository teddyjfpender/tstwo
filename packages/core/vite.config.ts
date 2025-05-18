import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'index.ts',
      name: '@tstwo/core',
      fileName: 'index'
    },
    outDir: 'dist',
    minify: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        format: 'esm'
      }
    }
  }
}) 
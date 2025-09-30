import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'src/index.tsx',
      output: {
        entryFileNames: '_worker.js',
        format: 'es'
      }
    },
    lib: {
      entry: 'src/index.tsx',
      formats: ['es']
    },
    target: 'esnext'
  }
})
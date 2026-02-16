import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'
import path from 'path'

export default defineConfig({
  root: 'src',
  publicDir: '../static',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  plugins: [
    glsl(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})

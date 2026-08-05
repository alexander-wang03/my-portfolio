import { defineConfig, type Plugin } from 'vite'
import glsl from 'vite-plugin-glsl'
import path from 'path'
import { renderFallbackHtml } from './src/content/fallback'

/**
 * Writes the portfolio content into index.html as real markup.
 *
 * Without this the served body is a bare <canvas>, so search engines, link
 * previews, screen readers and anyone without WebGL get an empty page. An
 * inline script in <head> hides it before first paint when JS is available,
 * so there is no flash for regular visitors.
 */
function fallbackContent(): Plugin {
  return {
    name: 'portfolio-fallback-content',
    transformIndexHtml(html) {
      return html.replace('</body>', `${renderFallbackHtml()}\n</body>`)
    },
  }
}

export default defineConfig({
  root: 'src',
  publicDir: '../static',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  plugins: [
    glsl(),
    fallbackContent(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})

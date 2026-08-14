import { defineConfig, type Plugin } from 'vite'
import glsl from 'vite-plugin-glsl'
import path from 'path'
import { renderFallbackHtml } from './src/content/fallback'
import { renderLoadingHtml } from './src/content/loading'

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
      return html
        .replace('<!--loading-screen-->', renderLoadingHtml())
        .replace('</body>', `${renderFallbackHtml()}\n</body>`)
    },
  }
}

/**
 * Tells the browser about the application chunks up front.
 *
 * They are reached through a dynamic import, so nothing in the served HTML
 * mentions them — the browser cannot start fetching until it has downloaded
 * and run the entry chunk, costing a round trip on the critical path before
 * the largest file has even been requested. Their names carry a content hash,
 * so the links have to be written from the finished bundle rather than by hand.
 */
function preloadChunks(): Plugin {
  return {
    name: 'portfolio-preload-chunks',
    // `post`, so the bundle is complete and the filenames are final
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html // dev server serves modules directly

        const preloaded = Object.values(ctx.bundle)
          .filter((output): output is typeof output & { type: 'chunk' } =>
            output.type === 'chunk' && !output.isEntry,
          )
          // Only what every visitor needs — dat.gui is for #debug alone
          .filter((chunk) => !chunk.fileName.includes('dat.gui'))
          .map((chunk) => `<link rel="modulepreload" href="/${chunk.fileName}">`)
          .join('\n    ')

        return html.replace('</head>', `    ${preloaded}\n</head>`)
      },
    },
  }
}

export default defineConfig({
  root: 'src',
  publicDir: '../static',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        /**
         * Rapier ships its wasm inlined as base64, which is most of the
         * payload on its own. In one chunk with everything else it had to
         * arrive complete before any of the app could run; split out, the
         * three fetch in parallel and each is cached under its own hash, so
         * editing the site does not re-download the engines behind it.
         */
        manualChunks(id) {
          if (id.includes('@dimforge/rapier3d-compat')) return 'rapier'
          if (id.includes('node_modules/three')) return 'three'
        },
      },
    },
  },
  plugins: [
    glsl(),
    fallbackContent(),
    preloadChunks(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})

import { defineConfig, type Plugin } from 'vite'
import glsl from 'vite-plugin-glsl'
import wasm from 'vite-plugin-wasm'
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

        const outputs = Object.values(ctx.bundle)
          // Only what every visitor needs — dat.gui is for #debug alone
          .filter((output) => !output.fileName.includes('dat.gui'))

        const chunks = outputs
          .filter((output): output is typeof output & { type: 'chunk' } =>
            output.type === 'chunk' && !output.isEntry,
          )
          .map((chunk) => `<link rel="modulepreload" href="/${chunk.fileName}">`)

        // Rapier's wasm is the single largest thing the page needs and the
        // last thing discovered: nothing requests it until the chunk that
        // imports it has downloaded, parsed and run. `as="fetch"` with
        // `crossorigin` matches how the glue asks for it, so the preload is
        // reused rather than fetched a second time.
        const wasmAssets = outputs
          .filter((output) => output.fileName.endsWith('.wasm'))
          .map((asset) =>
            `<link rel="preload" href="/${asset.fileName}" as="fetch" ` +
            `type="application/wasm" crossorigin>`,
          )

        // Joined with a template literal so the newline needs no escaping
        const preloaded = [...wasmAssets, ...chunks].join(`
    `)

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
    /**
     * Rapier's wasm glue is a top-level await, which Vite's default target
     * ('modules', ~2020 browsers) will not emit. Raising the floor to browsers
     * that support it natively costs Chrome 89, Safari 15 and Firefox 89 —
     * all from 2021, and all older than the versions already required
     * elsewhere on this site.
     *
     * The alternative, vite-plugin-top-level-await, fails to parse this
     * bundle: its bundled swc throws "missing field `type`" at generate time.
     */
    target: 'esnext',
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
          if (id.includes('@dimforge/rapier3d')) return 'rapier'
          if (id.includes('node_modules/three')) return 'three'
        },
      },
    },
  },
  plugins: [
    // Rapier is imported from `@dimforge/rapier3d`, whose glue does
    // `import * as wasm from './rapier_wasm3d_bg.wasm'`. This turns that into
    // a real emitted .wasm asset, and must run before the app is transformed.
    wasm(),
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

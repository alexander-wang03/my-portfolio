import { defineConfig, type Plugin } from 'vite'
import glsl from 'vite-plugin-glsl'
import wasm from 'vite-plugin-wasm'
import fs from 'fs'
import path from 'path'
import { renderFallbackHtml } from './src/content/fallback'
import { renderLoadingHtml } from './src/content/loading'
import { SITE_URL } from './src/content/portfolio'

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

/**
 * Injects a small script that reports real download progress.
 *
 * The loading screen is static markup now, so it paints immediately — but its
 * bar could not move until the application bundle had arrived and constructed,
 * which is the entire wait it exists to describe. It sat at 0% for ~800 kB and
 * then jumped, which reads as 'stuck', not 'loading'.
 *
 * Sizes come from the finished bundle, and progress from the Resource Timing
 * API, so nothing is downloaded twice to measure it. `decodedBodySize` is the
 * uncompressed size, which is what these figures are, so the maths holds
 * whether or not the server serves them gzipped.
 *
 * Resource Timing only reports a file once it has finished, so this advances
 * in a handful of steps rather than smoothly. That is still the truth, which a
 * flat 0% was not.
 */
function downloadProgress(): Plugin {
  /** Share of the bar given to downloading; the rest is building the world. */
  const DOWNLOAD_SHARE = 60

  return {
    name: 'portfolio-download-progress',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html // dev server: the bar stays indeterminate

        const sizes: Record<string, number> = {}
        for (const output of Object.values(ctx.bundle)) {
          if (output.fileName.includes('dat.gui')) continue // #debug only
          const body = output.type === 'chunk' ? output.code : output.source
          sizes['/' + output.fileName] =
            typeof body === 'string' ? Buffer.byteLength(body) : body.byteLength
        }

        const total = Object.values(sizes).reduce((sum, n) => sum + n, 0)

        const script =
          '<script>(function(){' +
          'var sizes=' + JSON.stringify(sizes) + ',total=' + total + ',loaded=0,seen={};' +
          "var bar=document.querySelector('.loading-progress');" +
          "var fill=document.querySelector('.loading-progress-fill');" +
          'if(!bar||!fill||!window.PerformanceObserver)return;' +
          'function count(entry){' +
          'var path=new URL(entry.name,location.href).pathname;' +
          'if(!(path in sizes)||seen[path])return;seen[path]=1;' +
          // A cached response can report 0, so fall back to the known size
          'loaded+=entry.decodedBodySize||sizes[path];' +
          "bar.classList.remove('loading-progress--indeterminate');" +
          'var pct=Math.min(loaded/total*' + DOWNLOAD_SHARE + ',' + DOWNLOAD_SHARE + ');' +
          // Never move backwards: the app drives the bar past this point, and a
          // late-finishing file would otherwise yank it back
          "if(!fill.style.width||pct>parseFloat(fill.style.width))fill.style.width=pct+'%';" +
          '}' +
          'new PerformanceObserver(function(list){list.getEntries().forEach(count)})' +
          ".observe({type:'resource',buffered:true});" +
          '})()</' + 'script>'

        return html.replace('</body>', `    ${script}
</body>`)
      },
    },
  }
}
/**
 * Emits robots.txt and sitemap.xml, and fills in the absolute URLs in <head>.
 *
 * All of it derives from SITE_URL so the four places that must agree cannot
 * drift apart.
 *
 * The sitemap lists two URLs and no more. The sections are addressable as
 * fragments (#projects and friends), but a fragment is not a separate URL —
 * crawlers strip it and see one page — so listing them would claim five pages
 * that resolve to the same document. The résumé is genuinely its own URL, and
 * PDFs are indexed.
 *
 * `lastmod` comes from the mtime of the file that actually holds the content,
 * not from the build clock, so rebuilding without editing anything does not
 * keep telling crawlers the page changed.
 */
function seoFiles(): Plugin {
  const CONTENT_SOURCE = 'src/content/portfolio.ts'
  const RESUME_FILE = 'static/CV.pdf'

  const lastModified = (file: string): string => {
    try {
      return fs.statSync(path.resolve(__dirname, file)).mtime.toISOString().slice(0, 10)
    } catch {
      return new Date().toISOString().slice(0, 10)
    }
  }

  return {
    name: 'portfolio-seo-files',
    apply: 'build',

    transformIndexHtml(html) {
      return html.replace('<!--absolute-urls-->', [
        `<link rel="canonical" href="${SITE_URL}/">`,
        `<meta property="og:url" content="${SITE_URL}/">`,
        `<meta property="og:image" content="${SITE_URL}/og-image.png">`,
        `<meta name="twitter:image" content="${SITE_URL}/og-image.png">`,
      ].join(`
    `))
    },

    generateBundle() {
      const pages = [
        { loc: '/', lastmod: lastModified(CONTENT_SOURCE), changefreq: 'monthly', priority: '1.0' },
        { loc: '/CV.pdf', lastmod: lastModified(RESUME_FILE), changefreq: 'yearly', priority: '0.5' },
      ]

      const urls = pages.map((page) => [
        '  <url>',
        `    <loc>${SITE_URL}${page.loc}</loc>`,
        `    <lastmod>${page.lastmod}</lastmod>`,
        `    <changefreq>${page.changefreq}</changefreq>`,
        `    <priority>${page.priority}</priority>`,
        '  </url>',
      ].join(`
`)).join(`
`)

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          urls,
          '</urlset>',
          '',
        ].join(`
`),
      })

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: [
          'User-agent: *',
          'Allow: /',
          '',
          '# The bundles and models are not content, and crawling them wastes',
          '# crawl budget on a site whose text is all in the HTML already.',
          'Disallow: /assets/',
          'Disallow: /models/',
          'Disallow: /sounds/',
          '',
          `Sitemap: ${SITE_URL}/sitemap.xml`,
          '',
        ].join(`
`),
      })
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
    downloadProgress(),
    seoFiles(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})

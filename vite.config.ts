import { defineConfig, type Plugin } from 'vite'
import glsl from 'vite-plugin-glsl'
import wasm from 'vite-plugin-wasm'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { renderFallbackHtml } from './src/content/fallback'
import { renderLoadingHtml } from './src/content/loading'
import { renderStructuredData } from './src/content/structuredData'
import { ABOUT, SITE_NAME, SITE_SHORT_NAME, SITE_URL } from './src/content/portfolio'

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
        .replace('</head>', `    ${renderStructuredData()}
</head>`)
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
 * `lastmod` is the date the content behind each URL last actually changed, so
 * that rebuilding without editing anything does not keep telling crawlers the
 * page changed. It comes from git rather than from the filesystem, because
 * `mtime` cannot answer that question on a build server: git does not record
 * mtimes, so a fresh checkout stamps every file with the time it was written
 * to disk. That is the build clock wearing a disguise, and it made every
 * deploy announce that both pages had just changed.
 *
 * Omitted entirely rather than guessed when it cannot be established. It is an
 * optional element, and search engines discount a `lastmod` they find
 * unreliable — a date that advances on every deploy is precisely that pattern,
 * so a wrong one is worse than none.
 */
function seoFiles(): Plugin {
  const CONTENT_SOURCE = 'src/content/portfolio.ts'
  const RESUME_FILE = 'static/CV.pdf'

  /** Run git, returning '' rather than throwing when it cannot answer. */
  const git = (...args: string[]): string => {
    try {
      return execFileSync('git', args, {
        cwd: __dirname,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    } catch {
      return ''
    }
  }

  const insideRepo = git('rev-parse', '--is-inside-work-tree') === 'true'

  /**
   * Commits where a shallow clone's history stops.
   *
   * These matter because `git log` does not report the truncation — it reports
   * the boundary commit. Every file that was last touched before it looks like
   * it was created there, so asking a depth-10 clone when `CV.pdf` last
   * changed cheerfully returns the date of HEAD. Verified against a `--depth 1`
   * clone of this repo, which dated a file from February to today.
   */
  const shallowBoundaries = ((): Set<string> => {
    if (!insideRepo) return new Set()
    try {
      const file = path.resolve(__dirname, git('rev-parse', '--git-path', 'shallow'))
      return new Set(fs.readFileSync(file, 'utf8').split(`
`).map((line) => line.trim()).filter(Boolean))
    } catch {
      return new Set() // no such file: a complete clone, nothing to distrust
    }
  })()

  const asDate = (iso: string): string => iso.slice(0, 10)

  const mtime = (file: string): string | null => {
    try {
      return asDate(fs.statSync(path.resolve(__dirname, file)).mtime.toISOString())
    } catch {
      return null
    }
  }

  const lastModified = (file: string): string | null => {
    // No repository at all — a downloaded copy rather than a clone, where the
    // filesystem is the only record there is and its mtimes are real edits.
    if (!insideRepo) return mtime(file)

    // Committed history describes committed content. Local edits that have not
    // been committed are still real edits, and only the filesystem knows them.
    if (git('status', '--porcelain', '--', file) !== '') return mtime(file)

    const [sha, iso] = git('log', '-1', '--format=%H %cI', '--', file).split(' ')
    if (!sha || !iso) return null // untracked, or no history to read
    if (shallowBoundaries.has(sha)) return null // the truncation described above

    return asDate(iso)
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
        { loc: '/', source: CONTENT_SOURCE, changefreq: 'monthly', priority: '1.0' },
        { loc: '/CV.pdf', source: RESUME_FILE, changefreq: 'yearly', priority: '0.5' },
      ].map((page) => ({ ...page, lastmod: lastModified(page.source) }))

      const undated = pages.filter((page) => page.lastmod === null)
      if (undated.length > 0) {
        // Loud, because the likely cause is a shallow clone on a build server
        // and the symptom is silent: a sitemap that is merely less informative
        // than it was, with nothing to say why.
        this.warn(
          `sitemap.xml: no lastmod for ${undated.map((page) => page.loc).join(', ')} — ` +
          'could not read when the content last changed. On Vercel this means a ' +
          'shallow clone; set VERCEL_DEEP_CLONE=1 to give the build real history.',
        )
      }

      const urls = pages.map((page) => [
        '  <url>',
        `    <loc>${SITE_URL}${page.loc}</loc>`,
        // Left out rather than guessed — see the note on this plugin
        ...(page.lastmod ? [`    <lastmod>${page.lastmod}</lastmod>`] : []),
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

      // Android's "add to home screen" reads this; without it the launcher
      // guesses a name from <title> and an icon from apple-touch-icon.
      this.emitFile({
        type: 'asset',
        fileName: 'site.webmanifest',
        source: JSON.stringify({
          name: SITE_NAME,
          short_name: SITE_SHORT_NAME,
          description: ABOUT.tagline,
          start_url: '/',
          scope: '/',
          // Launched from the home screen it opens without browser chrome,
          // which suits a full-screen world. In a normal tab this is ignored.
          display: 'standalone',
          background_color: '#0a0504',
          theme_color: '#0a0504',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            // Padded to the 80% safe circle, so a launcher that crops to its
            // own shape takes the background rather than the monogram
            { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        }, null, 2) + `
`,
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

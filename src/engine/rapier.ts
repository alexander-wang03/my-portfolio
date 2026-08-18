import RAPIER from '@dimforge/rapier3d'
// Imported for its side effect, and referenced below so it survives bundling
import * as wasmHookup from '@dimforge/rapier3d/rapier_wasm3d.js'

/**
 * Rapier, with its WebAssembly module guaranteed to be wired up.
 *
 * Import Rapier from here rather than from the package directly.
 *
 * `@dimforge/rapier3d/rapier_wasm3d.js` exists purely for a side effect: it
 * imports the .wasm module and hands it to the bindings with
 * `__wbg_set_wasm(wasm)`. Nothing imports a *binding* from it — everything is
 * re-exported straight through to `rapier_wasm3d_bg.js` — so Rollup drops it,
 * and the bundle ends up beginning with a bare `let wasm;` that nothing ever
 * assigns. The build succeeds, the .wasm file is emitted, and every Rapier
 * call then fails on undefined at runtime.
 *
 * The package does list the file under `sideEffects`, and Vite does resolve it
 * with `moduleSideEffects: true`, but it is still dropped — and forcing the
 * flag in `resolveId`, or setting `treeshake.moduleSideEffects` globally, both
 * changed nothing. Referencing the namespace is what actually holds it: a used
 * binding is not something tree-shaking is allowed to remove.
 *
 * The compat build did not need any of this, because it inlined its wasm as
 * base64 and hooked it up inside `RAPIER.init()`.
 */
if (!wasmHookup) {
    throw new Error('[rapier] wasm bindings missing — the hookup module was tree-shaken')
}

export default RAPIER

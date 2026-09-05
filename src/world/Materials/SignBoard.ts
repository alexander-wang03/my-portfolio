import * as THREE from 'three'
import { registerRevealFade } from '../Reveal'

/**
 * Shared helpers for the canvas-texture sign boards used by every section.
 *
 * Boards are flat materials rather than matcaps, so they cannot ride the
 * reveal wave in a vertex shader — `createBoardMaterial` registers them to
 * fade in instead.
 */

export const BOARD_BACKGROUND = '#1a0e08'
/** The board's cut edge. Lifted off the face so the thickness is visible. */
export const BOARD_EDGE = '#2e1a10'
export const BOARD_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

export interface TextTextureOptions {
    fontSize?: number
    color?: string
    bg?: string
}

/** Draw into an offscreen canvas of the given size and return it as a texture. */
export function createCanvasTexture(
    width: number,
    height: number,
    draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')!
    draw(ctx, width, height)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
}

/** A single line of centred text on an optional solid background. */
export function createTextTexture(
    text: string,
    width: number,
    height: number,
    opts: TextTextureOptions = {},
): THREE.CanvasTexture {
    return createCanvasTexture(width, height, (ctx) => {
        if (opts.bg) {
            ctx.fillStyle = opts.bg
            ctx.fillRect(0, 0, width, height)
        }

        ctx.fillStyle = opts.color ?? '#ffffff'
        ctx.font = `bold ${opts.fontSize ?? 48}px ${BOARD_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, width / 2, height / 2)
    })
}

/**
 * Word-wrap `text` at `maxWidth`, drawing centred lines from `y` downwards.
 * Returns the y coordinate just past the last line.
 */
export function fillWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    centerX: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
): number {
    let line = ''
    let cursorY = y

    for (const word of text.split(' ')) {
        const candidate = line + word + ' '
        if (ctx.measureText(candidate).width > maxWidth && line.length > 0) {
            ctx.fillText(line.trim(), centerX, cursorY)
            line = word + ' '
            cursorY += lineHeight
        } else {
            line = candidate
        }
    }

    if (line.trim()) {
        ctx.fillText(line.trim(), centerX, cursorY)
        cursorY += lineHeight
    }

    return cursorY
}

/**
 * Thickness given to a sign board, in world units.
 *
 * Small enough to read as sheet metal rather than as a slab, large enough that
 * the edge is still a couple of pixels at the distance the camera sits.
 */
export const BOARD_DEPTH = 0.08

/** The cut edge of a board — plain, and a shade off the printed face. */
function createBoardEdgeMaterial(): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial({ color: BOARD_EDGE })
    registerRevealFade(material)
    return material
}

/**
 * A sign board with actual thickness.
 *
 * These were `PlaneGeometry`, which has none — from the side they vanished to
 * a line, and against low-poly terrain that reads as a decal rather than as an
 * object standing in the world.
 *
 * The printed face goes on both +Z and -Z. A box's faces each carry their own
 * UVs, oriented to read upright from outside, so the back is legible rather
 * than mirrored — which is what the old double-sided plane gave you.
 */
export function createBoardMesh(
    width: number,
    height: number,
    texture: THREE.Texture,
    depth = BOARD_DEPTH,
): THREE.Mesh {
    const face = createBoardMaterial(texture)
    const edge = createBoardEdgeMaterial()

    // BoxGeometry groups run +x, -x, +y, -y, +z, -z
    return new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        [edge, edge, edge, edge, face, face],
    )
}

/** Double-sided board material that fades in with the reveal animation. */
export function createBoardMaterial(texture: THREE.Texture): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
    })

    registerRevealFade(material)

    return material
}

import * as THREE from 'three'
import type Terrain from '../Terrain'
import { registerRevealFade } from '../Reveal'
import { BOARD_FONT, createCanvasTexture } from '../Materials/SignBoard'

export interface InstructionsOptions {
    terrain: Terrain
    /** Show the touch legend instead of the keyboard one. */
    touch: boolean
    x: number
    z: number
}

/**
 * Control legend painted flat on the ground by the spawn point, in the spirit
 * of folio-2019's floor instructions. Drawn to a canvas rather than loaded as
 * an image, since this project ships no texture assets.
 */

// 2:1, matching the canvas, so nothing is stretched. Sized generously because
// a floor decal is foreshortened hard by the camera's ~32° elevation.
const PANEL_WIDTH = 11
const PANEL_DEPTH = 5.5
const CANVAS_WIDTH = 1024
const CANVAS_HEIGHT = 512

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
): void {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}

function drawKeycap(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    label: string, fontSize: number,
): void {
    roundRect(ctx, x, y, w, h, 12)
    ctx.fillStyle = 'rgba(26, 14, 8, 0.72)'
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.stroke()

    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${fontSize}px ${BOARD_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x + w / 2, y + h / 2 + 1)
}

function drawTitle(ctx: CanvasRenderingContext2D, y: number): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.font = `bold 34px ${BOARD_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('C O N T R O L S', CANVAS_WIDTH / 2, y)
}

function drawFooter(ctx: CanvasRenderingContext2D, text: string): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.62)'
    ctx.font = `24px ${BOARD_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, CANVAS_WIDTH / 2, 480)
}

function drawKeyboardLegend(ctx: CanvasRenderingContext2D): void {
    drawTitle(ctx, 48)

    // Arrow cluster, laid out as the usual inverted T
    const size = 78
    const pitch = 86
    const cx = 250
    const cy = 235

    drawKeycap(ctx, cx - size / 2, cy - pitch, size, size, '↑', 40)
    drawKeycap(ctx, cx - size / 2 - pitch, cy, size, size, '←', 40)
    drawKeycap(ctx, cx - size / 2, cy, size, size, '↓', 40)
    drawKeycap(ctx, cx - size / 2 + pitch, cy, size, size, '→', 40)

    ctx.fillStyle = '#ffffff'
    ctx.font = `bold 30px ${BOARD_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('DRIVE & STEER', cx, cy + size + 46)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.font = `24px ${BOARD_FONT}`
    ctx.fillText('or W A S D', cx, cy + size + 84)

    // Everything else, one keycap per row
    const rows = [
        { key: 'SHIFT', label: 'BOOST' },
        { key: 'SPACE', label: 'BRAKE' },
        { key: 'R', label: 'RESET ROVER' },
        { key: 'M', label: 'MUTE SOUND' },
    ]

    const colX = 520
    const keyW = 156
    const keyH = 62
    let y = 118

    for (const row of rows) {
        drawKeycap(ctx, colX, y, keyW, keyH, row.key, row.key.length > 1 ? 28 : 34)

        ctx.fillStyle = '#ffffff'
        ctx.font = `bold 28px ${BOARD_FONT}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(row.label, colX + keyW + 26, y + keyH / 2 + 1)

        y += keyH + 22
    }

    drawFooter(ctx, 'drive into a sign to open it')
}

function drawTouchLegend(ctx: CanvasRenderingContext2D): void {
    drawTitle(ctx, 84)

    const lines = [
        'JOYSTICK  —  drive & steer',
        'BOOST / BRAKE  —  bottom right',
    ]

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    let y = 210
    for (const line of lines) {
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold 32px ${BOARD_FONT}`
        ctx.fillText(line, CANVAS_WIDTH / 2, y)
        y += 74
    }

    drawFooter(ctx, 'drive into a sign to open it')
}

export default class Instructions {
    container: THREE.Object3D

    constructor(options: InstructionsOptions) {
        this.container = new THREE.Object3D()

        const texture = createCanvasTexture(CANVAS_WIDTH, CANVAS_HEIGHT, (ctx) => {
            if (options.touch) drawTouchLegend(ctx)
            else drawKeyboardLegend(ctx)
        })

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
        })

        // The canvas is mostly transparent, so this one must not flip back to
        // opaque when the reveal finishes the way the sign boards do.
        registerRevealFade(material, { alwaysTransparent: true })

        // Axis-aligned with the map, not with the camera — text reads along +X
        // with its top toward -Z, matching the terrain grid and the sign rows.
        const geometry = new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_DEPTH, 24, 12)
        geometry.rotateX(-Math.PI / 2)

        // Drape the panel over the terrain so it never clips through a rise
        const position = geometry.attributes.position
        for (let i = 0; i < position.count; i++) {
            const worldX = options.x + position.getX(i)
            const worldZ = options.z + position.getZ(i)
            position.setY(i, options.terrain.getSurfaceHeightAt(worldX, worldZ) + 0.02)
        }
        position.needsUpdate = true
        geometry.computeBoundingSphere()

        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(options.x, 0, options.z)
        this.container.add(mesh)
    }
}

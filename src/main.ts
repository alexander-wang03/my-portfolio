import Application from './engine/Application'

const canvas = document.querySelector('canvas.js-canvas') as HTMLCanvasElement

if (canvas) {
    new Application({ canvas })
}

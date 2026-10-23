// Renders build/icon.svg and build/tray.svg to every PNG the app and the installers need.
// Run with `npm run icons` (uses Electron's Chromium as the rasterizer).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow } from 'electron'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUILD = join(ROOT, 'build')
const ASSETS = join(ROOT, 'electron', 'assets')
const ALERT = '#F2364F'

const icon = readFileSync(join(BUILD, 'icon.svg'), 'utf8')
// Small sizes drop the macOS safe-area margin so the glyph stays legible.
const tight = icon.replace('viewBox="0 0 1024 1024"', 'viewBox="100 100 824 824"')
const tray = readFileSync(join(BUILD, 'tray.svg'), 'utf8')

app.dock?.hide()
let win

// dot: 'color' draws a red dot with a light ring, 'mask' punches a ring then fills it black (template images)
function render(svg, size, { dot, only } = {}) {
  const src = `data:image/svg+xml;base64,${Buffer.from(svg ?? '<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')}`
  return win.webContents.executeJavaScript(`(async () => {
    const s = ${size}
    const c = document.createElement('canvas')
    c.width = c.height = s
    const g = c.getContext('2d')
    if (!${!!only}) {
      const img = new Image()
      img.src = '${src}'
      await img.decode()
      g.drawImage(img, 0, 0, s, s)
    }
    const dot = ${JSON.stringify(dot ?? null)}
    if (dot) {
      const x = ${only ? 's / 2' : 's * 0.76'}, y = ${only ? 's / 2' : 's * 0.24'}, r = ${only ? 's * 0.4' : 's * 0.22'}
      g.globalCompositeOperation = 'destination-out'
      g.beginPath(); g.arc(x, y, r + s * 0.08, 0, 7); g.fill()
      g.globalCompositeOperation = 'source-over'
      if (dot === 'color') { g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x, y, r + s * 0.06, 0, 7); g.fill() }
      g.fillStyle = dot === 'color' ? '${ALERT}' : '#000'
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill()
    }
    return c.toDataURL('image/png')
  })()`)
}

async function out(file, ...args) {
  const url = await render(...args)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'))
  console.log('✔', file.slice(ROOT.length + 1))
}

// Top-level await before `ready` would deadlock Electron's ESM loader.
app.whenReady().then(async () => {
  win = new BrowserWindow({ show: false })
  await win.loadURL('data:text/html,<body></body>')
  await out(join(BUILD, 'icon.png'), icon, 1024)
  for (const s of [16, 24, 32, 48, 64, 128, 256, 512]) await out(join(BUILD, 'icons', `${s}x${s}.png`), s < 64 ? tight : icon, s)
  await out(join(ASSETS, 'icon.png'), icon, 256)
  await out(join(ROOT, 'public', 'icon.png'), icon, 256)
  for (const [suffix, scale] of [['', 1], ['@2x', 2]]) {
    const s = 16 * scale
    await out(join(ASSETS, `tray${suffix}.png`), tight, s)
    await out(join(ASSETS, `tray-alert${suffix}.png`), tight, s, { dot: 'color' })
    await out(join(ASSETS, `trayTemplate${suffix}.png`), tray, s)
    await out(join(ASSETS, `trayAlertTemplate${suffix}.png`), tray, s, { dot: 'mask' })
    await out(join(ASSETS, `badge${suffix}.png`), null, s, { dot: 'color', only: true })
  }
  app.quit()
})

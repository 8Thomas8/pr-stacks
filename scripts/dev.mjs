#!/usr/bin/env node
// Runs `nuxt dev` and opens the Electron window on it once the dev server answers (HMR included).
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const URL = 'http://127.0.0.1:4321/'

const nuxt = spawn(process.execPath, [join(ROOT, 'node_modules', 'nuxt', 'bin', 'nuxt.mjs'), 'dev'], { cwd: ROOT, stdio: 'inherit' })
let electron
const stop = (code = 0) => {
  electron?.kill()
  // nuxt dev runs the server in a child process; Windows has no SIGTERM, so kill the whole tree
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(nuxt.pid), '/T', '/F'], { stdio: 'ignore' })
  else nuxt.kill()
  process.exit(code)
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => stop())
nuxt.on('exit', code => stop(code ?? 0))

async function ready() {
  for (;;) {
    try {
      if ((await fetch(URL)).ok) return
    }
    catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500))
  }
}

await ready()
electron = spawn(process.execPath, [join(ROOT, 'node_modules', 'electron', 'cli.js'), ROOT], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_DEV_URL: URL },
})
electron.on('exit', code => stop(code ?? 0))

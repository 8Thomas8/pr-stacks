#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = join(ROOT, '.output')
const STAMP = join(OUTPUT, '.build-hash')
const SERVER = join(OUTPUT, 'server', 'index.mjs')
const ELECTRON = join(ROOT, 'node_modules', 'electron', 'cli.js')

const SOURCES = ['app', 'electron/nitro-entry.ts', 'server', 'shared', 'i18n', 'public', 'nuxt.config.ts', 'package.json', 'package-lock.json', 'tsconfig.json']

function files(path) {
  if (!existsSync(path)) return []
  if (!statSync(path).isDirectory()) return [path]
  return readdirSync(path, { withFileTypes: true }).flatMap(e => files(join(path, e.name)))
}

function sourceHash() {
  const hash = createHash('sha256')
  for (const file of SOURCES.flatMap(s => files(join(ROOT, s))).sort()) {
    hash.update(relative(ROOT, file)).update('\0').update(readFileSync(file)).update('\0')
  }
  return hash.digest('hex')
}

const force = process.argv.includes('--build')
const hash = sourceHash()
const built = existsSync(SERVER) && existsSync(STAMP) && readFileSync(STAMP, 'utf8').trim() === hash

if (built && !force) {
  console.log('✔ Build up to date, skipping nuxt build')
}
else {
  console.log(force ? '● Rebuild requested' : existsSync(SERVER) ? '● Sources changed since the last build, rebuilding…' : '● No build yet, building…')
  const res = spawnSync(process.execPath, [join(ROOT, 'node_modules', 'nuxt', 'bin', 'nuxt.mjs'), 'build'], { cwd: ROOT, stdio: 'inherit' })
  if (res.status !== 0) process.exit(res.status ?? 1)
  writeFileSync(STAMP, `${hash}\n`)
}

const electron = spawn(process.execPath, [ELECTRON, ROOT], { cwd: ROOT, stdio: 'inherit' })
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => electron.kill(sig))
electron.on('exit', code => process.exit(code ?? 0))

#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'i18n', 'locales')
const flatten = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
  v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)]])
const params = msg => [...new Set([...msg.matchAll(/\{(\w+)\}/g)].map(m => m[1]))].sort().join(',')

const locales = Object.fromEntries(readdirSync(DIR).filter(f => f.endsWith('.json'))
  .map(f => [f, new Map(flatten(JSON.parse(readFileSync(join(DIR, f), 'utf8'))))]))
const allKeys = new Set(Object.values(locales).flatMap(m => [...m.keys()]))
const problems = []
for (const key of [...allKeys].sort()) {
  const present = Object.entries(locales).filter(([, m]) => m.has(key))
  for (const [file, m] of Object.entries(locales)) if (!m.has(key)) problems.push(`${file}: missing "${key}"`)
  const shapes = new Set(present.map(([, m]) => params(m.get(key))))
  if (shapes.size > 1) problems.push(`"${key}": placeholders differ (${present.map(([f, m]) => `${f} {${params(m.get(key))}}`).join(' vs ')})`)
}
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`✔ ${Object.keys(locales).length} locales, ${allKeys.size} keys, all in sync`)

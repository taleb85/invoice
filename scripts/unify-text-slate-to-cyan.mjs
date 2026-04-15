#!/usr/bin/env node
/**
 * Idempotent: map Tailwind text-slate-* foregrounds to cyan-tinted equivalents
 * for the Fluxo canvas. Preserves opacity suffixes on 50–700.
 * Also: text-slate-800 → text-cyan-100/90; text-slate-950 / text-slate-900 → text-cyan-950 (ink on bright surfaces).
 */
import fs from 'node:fs'
import path from 'node:path'

const mapNoOp = {
  '700': 'text-cyan-600/55',
  '600': 'text-cyan-500/50',
  '500': 'text-cyan-400/60',
  '400': 'text-cyan-300/72',
  '300': 'text-cyan-200/80',
  '200': 'text-cyan-100/88',
  '50': 'text-cyan-50/95',
}
const baseForOp = {
  '700': 'text-cyan-600',
  '600': 'text-cyan-500',
  '500': 'text-cyan-400',
  '400': 'text-cyan-300',
  '300': 'text-cyan-200',
  '200': 'text-cyan-100',
  '50': 'text-cyan-50',
}

const re = /(?<![\w/])text-slate-(700|600|500|400|300|200|50)(\/[\d.]+)?/g

const re800 = /(?<![\w/])text-slate-800(\/[\d.]+)?/g
const reInk = /(?<![\w/])text-slate-950(\/[\d.]+)?/g
const re900 = /(?<![\w/])text-slate-900(\/[\d.]+)?/g

function transform(content) {
  let s = content.replace(re, (full, shade, op) => {
    if (op) return baseForOp[shade] + op
    return mapNoOp[shade]
  })
  s = s.replace(re800, (full, op) => (op ? 'text-cyan-100' + op : 'text-cyan-100/90'))
  s = s.replace(reInk, (full, op) => (op ? 'text-cyan-950' + op : 'text-cyan-950'))
  s = s.replace(re900, (full, op) => (op ? 'text-cyan-950' + op : 'text-cyan-950'))
  return s
}

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc)
    else if (/\.(tsx|ts|css)$/.test(ent.name)) acc.push(p)
  }
  return acc
}

const src = path.join(process.cwd(), 'src')
const files = walk(src)
let updated = 0
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8')
  const t = transform(c)
  if (t !== c) {
    fs.writeFileSync(f, t)
    updated++
  }
}
console.log(`unify-text-slate-to-cyan: updated ${updated} files`)

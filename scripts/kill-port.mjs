#!/usr/bin/env node
/**
 * Libera una porta TCP (default 3000) su macOS/Linux: utile prima di `npm run dev`
 * se Next segnala "Another next dev server is already running".
 */
import { execSync } from 'node:child_process'

const port = process.argv[2] ? Number(process.argv[2], 10) : 3000
if (!Number.isFinite(port) || port < 1) {
  console.error('Usage: node scripts/kill-port.mjs [port]')
  process.exit(1)
}

try {
  const out = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim()
  if (!out) process.exit(0)
  const pids = out.split(/\s+/).filter(Boolean)
  for (const pid of pids) {
    try {
      process.kill(Number(pid, 10), 'SIGTERM')
    } catch {
      // ignore
    }
  }
} catch {
  // Nessun processo in ascolto su questa porta
}

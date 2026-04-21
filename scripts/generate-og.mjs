import { createCanvas } from 'canvas'
import fs from 'fs'

const canvas = createCanvas(1200, 630)
const ctx = canvas.getContext('2d')

// Background
ctx.fillStyle = '#0a192f'
ctx.fillRect(0, 0, 1200, 630)

// Subtle grid pattern
ctx.strokeStyle = 'rgba(34, 211, 238, 0.05)'
ctx.lineWidth = 1
for (let x = 0; x < 1200; x += 60) {
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 630); ctx.stroke()
}
for (let y = 0; y < 630; y += 60) {
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke()
}

// Glow — bottom right
const gradient = ctx.createRadialGradient(1100, 550, 0, 1100, 550, 400)
gradient.addColorStop(0, 'rgba(34, 211, 238, 0.12)')
gradient.addColorStop(1, 'rgba(34, 211, 238, 0)')
ctx.fillStyle = gradient
ctx.fillRect(0, 0, 1200, 630)

// Glow — top left (secondary, indigo)
const gradient2 = ctx.createRadialGradient(100, 80, 0, 100, 80, 300)
gradient2.addColorStop(0, 'rgba(91, 124, 249, 0.08)')
gradient2.addColorStop(1, 'rgba(91, 124, 249, 0)')
ctx.fillStyle = gradient2
ctx.fillRect(0, 0, 1200, 630)

// ── Icon background square ──────────────────────────────────────────────────
const iconSize = 120
const iconX = (1200 - iconSize) / 2   // centred horizontally
const iconY = 155
const iconRadius = 28

ctx.fillStyle = '#0f2a4a'
ctx.beginPath()
ctx.roundRect(iconX, iconY, iconSize, iconSize, iconRadius)
ctx.fill()

// Icon border
ctx.strokeStyle = 'rgba(34, 211, 238, 0.3)'
ctx.lineWidth = 2
ctx.beginPath()
ctx.roundRect(iconX, iconY, iconSize, iconSize, iconRadius)
ctx.stroke()

// ── Arrow paths (centred in icon square) ────────────────────────────────────
const cx = iconX + iconSize / 2
const cy = iconY + iconSize / 2

// Up-right arrow (cyan)
ctx.strokeStyle = '#22d3ee'
ctx.lineWidth = 8
ctx.lineCap = 'round'
ctx.lineJoin = 'round'
ctx.beginPath()
ctx.moveTo(cx - 30, cy + 8)
ctx.lineTo(cx - 8,  cy - 18)
ctx.lineTo(cx - 8,  cy - 4)
ctx.lineTo(cx + 18, cy - 4)
ctx.lineTo(cx + 18, cy + 8)
ctx.stroke()

// Down-left arrow (indigo)
ctx.strokeStyle = '#5b7cf9'
ctx.beginPath()
ctx.moveTo(cx + 30, cy - 8)
ctx.lineTo(cx + 8,  cy + 18)
ctx.lineTo(cx + 8,  cy + 4)
ctx.lineTo(cx - 18, cy + 4)
ctx.lineTo(cx - 18, cy - 8)
ctx.stroke()

// ── Wordmark ─────────────────────────────────────────────────────────────────
// "Smart" (bold, cyan) — measure to place "Pair" right after it
ctx.font = 'bold 72px sans-serif'
ctx.textAlign = 'left'
const smartWidth = ctx.measureText('Smart').width

// Centre both words together
const pairFont = '300 72px sans-serif'
ctx.font = pairFont
const pairWidth = ctx.measureText(' Pair').width
const totalWidth = smartWidth + pairWidth
const wordmarkX = (1200 - totalWidth) / 2
const wordmarkY = 370

ctx.font = 'bold 72px sans-serif'
ctx.fillStyle = '#22d3ee'
ctx.fillText('Smart', wordmarkX, wordmarkY)

ctx.font = '300 72px sans-serif'
ctx.fillStyle = 'rgba(236, 254, 255, 0.85)'
ctx.fillText(' Pair', wordmarkX + smartWidth, wordmarkY)

// ── Tagline ───────────────────────────────────────────────────────────────────
ctx.font = '400 18px sans-serif'
ctx.fillStyle = 'rgba(34, 211, 238, 0.4)'
ctx.textAlign = 'center'
ctx.fillText('INVOICE  MANAGEMENT', 600, 425)

// ── Save ──────────────────────────────────────────────────────────────────────
const buffer = canvas.toBuffer('image/png')
fs.writeFileSync('public/og-image.png', buffer)
console.log('✓ OG image saved: public/og-image.png (1200×630)')

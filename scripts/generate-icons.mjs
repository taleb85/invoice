import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'public/icons')
mkdirSync(outDir, { recursive: true })

// SVG sorgente dell'icona (sfondo navy + FLUXO + wave)
const svg = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a5f"/>
      <stop offset="100%" stop-color="#0f2a3f"/>
    </linearGradient>
    <linearGradient id="flow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <!-- Sfondo con bordi arrotondati -->
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <!-- Testo FLUXO centrato -->
  <text x="256" y="240"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="130"
    font-weight="700"
    fill="url(#flow)"
    letter-spacing="4">FLUXO</text>
  <!-- Wave sottostante -->
  <path d="M80 330 C140 270, 220 270, 280 330 S390 390, 440 330"
    stroke="url(#flow)"
    stroke-width="22"
    fill="none"
    stroke-linecap="round"/>
  <!-- Nodi -->
  <circle cx="80"  cy="330" r="18" fill="#3b82f6"/>
  <circle cx="280" cy="330" r="18" fill="#22d3ee"/>
  <circle cx="440" cy="330" r="18" fill="#3b82f6"/>
</svg>`

// Versione maskable: padding 20% per safe area
const svgMaskable = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a5f"/>
      <stop offset="100%" stop-color="#0f2a3f"/>
    </linearGradient>
    <linearGradient id="flow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <text x="256" y="256"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="110"
    font-weight="700"
    fill="url(#flow)"
    letter-spacing="4">FLUXO</text>
  <path d="M100 340 C155 290, 225 290, 275 340 S370 390, 415 340"
    stroke="url(#flow)"
    stroke-width="18"
    fill="none"
    stroke-linecap="round"/>
  <circle cx="100" cy="340" r="14" fill="#3b82f6"/>
  <circle cx="275" cy="340" r="14" fill="#22d3ee"/>
  <circle cx="415" cy="340" r="14" fill="#3b82f6"/>
</svg>`

const svgBuf = Buffer.from(svg)
const svgMaskBuf = Buffer.from(svgMaskable)

const sizes = [192, 512]

for (const size of sizes) {
  await sharp(svgBuf).resize(size, size).png().toFile(join(outDir, `icon-${size}.png`))
  console.log(`✓ icon-${size}.png`)

  await sharp(svgMaskBuf).resize(size, size).png().toFile(join(outDir, `icon-maskable-${size}.png`))
  console.log(`✓ icon-maskable-${size}.png`)
}

// Apple touch icon (180x180, niente trasparenza per iOS)
await sharp(svgMaskBuf).resize(180, 180).png().toFile(join(root, 'public/apple-touch-icon.png'))
console.log('✓ apple-touch-icon.png')

console.log('\nTutte le icone generate con successo.')

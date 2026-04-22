import sharp from 'sharp'

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="#0f2a4a"/>
  <path d="M64 256 L176 144 L176 208 L336 208 L336 256"
    fill="none" stroke="#22d3ee" stroke-width="40"
    stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M448 256 L336 368 L336 304 L176 304 L176 256"
    fill="none" stroke="#5b7cf9" stroke-width="40"
    stroke-linejoin="round" stroke-linecap="round"/>
</svg>`

const svgBuffer = Buffer.from(svgContent)

await sharp(svgBuffer).resize(180, 180).png().toFile('public/apple-touch-icon.png')
console.log('✓ apple-touch-icon.png (180x180)')

await sharp(svgBuffer).resize(192, 192).png().toFile('public/icons/icon-192.png')
console.log('✓ icon-192.png (192x192)')

await sharp(svgBuffer).resize(512, 512).png().toFile('public/icons/icon-512.png')
console.log('✓ icon-512.png (512x512)')

// Maskable icons (same content, icons already have safe zone padding via rx="112")
await sharp(svgBuffer).resize(192, 192).png().toFile('public/icons/icon-maskable-192.png')
console.log('✓ icon-maskable-192.png')

await sharp(svgBuffer).resize(512, 512).png().toFile('public/icons/icon-maskable-512.png')
console.log('✓ icon-maskable-512.png')

console.log('\nAll icons generated!')

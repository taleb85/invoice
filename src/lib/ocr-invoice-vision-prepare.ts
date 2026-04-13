import 'server-only'

import sharp from 'sharp'

const VISION_MAX_LONG_EDGE_PX = 2000
const VISION_JPEG_QUALITY = 80

export async function prepareImageBufferForVision(
  buf: Buffer,
  contentType: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  if (!contentType.startsWith('image/')) {
    return { buffer: buf, contentType }
  }
  try {
    let pipeline = sharp(buf, { failOn: 'none' }).rotate()
    const meta = await pipeline.metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    const long = Math.max(w, h)
    if (long > VISION_MAX_LONG_EDGE_PX) {
      pipeline = sharp(buf, { failOn: 'none' })
        .rotate()
        .resize({
          width: w >= h ? VISION_MAX_LONG_EDGE_PX : undefined,
          height: h > w ? VISION_MAX_LONG_EDGE_PX : undefined,
          fit: 'inside',
          withoutEnlargement: true,
        })
    }
    const out = await pipeline.jpeg({ quality: VISION_JPEG_QUALITY, mozjpeg: true }).toBuffer()
    return { buffer: out, contentType: 'image/jpeg' }
  } catch (e) {
    console.warn('[OCR] prepareImageBufferForVision fallito, uso originale:', e)
    return { buffer: buf, contentType }
  }
}

/** PDF scannerizzato: prima pagina → JPEG (richiede sharp con supporto PDF/poppler). */
export async function tryRasterizePdfFirstPageForVision(buf: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buf, { density: 144, page: 0, failOn: 'none' })
      .resize({
        width: VISION_MAX_LONG_EDGE_PX,
        height: VISION_MAX_LONG_EDGE_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: VISION_JPEG_QUALITY, mozjpeg: true })
      .toBuffer()
  } catch {
    return null
  }
}

export async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    try {
      const result = await parser.getText()
      return result.text?.trim() || null
    } finally {
      await parser.destroy()
    }
  } catch {
    return null
  }
}

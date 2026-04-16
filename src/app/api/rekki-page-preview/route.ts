import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const MAX_HTML = 400_000
const FETCH_TIMEOUT_MS = 12_000

function isAllowedRekkiUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const h = url.hostname.toLowerCase()
  return h === 'rekki.com' || h === 'www.rekki.com'
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function metaPropertyContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escaped}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return decodeBasicEntities(m[1].trim())
  }
  return null
}

function documentTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return m?.[1] ? decodeBasicEntities(m[1].trim()) : null
}

function metaNameContent(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i')
  const m = html.match(re)
  if (m?.[1]) return decodeBasicEntities(m[1].trim())
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escaped}["']`, 'i')
  const m2 = html.match(re2)
  if (m2?.[1]) return decodeBasicEntities(m2[1].trim())
  return null
}

function absolutizeUrl(base: string, candidate: string | null): string | null {
  if (!candidate) return null
  const t = candidate.trim()
  if (!t) return null
  try {
    if (t.startsWith('//')) return new URL(`https:${t}`).href
    return new URL(t, base).href
  } catch {
    return t
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const urlParam = req.nextUrl.searchParams.get('url')?.trim() ?? ''
  if (!urlParam || !isAllowedRekkiUrl(urlParam)) {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(urlParam, {
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        'User-Agent': 'InvoiceApp/1.0 (Rekki page preview; authenticated operator)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9,it;q=0.8',
      },
    })
    clearTimeout(timer)
    if (!res.ok) {
      return NextResponse.json(
        { title: null, description: null, image: null, httpStatus: res.status },
        { headers: { 'Cache-Control': 'private, max-age=120' } },
      )
    }
    const text = await res.text()
    const html = text.length > MAX_HTML ? text.slice(0, MAX_HTML) : text
    const title =
      metaPropertyContent(html, 'og:title') ??
      metaNameContent(html, 'twitter:title') ??
      documentTitle(html)
    const description =
      metaPropertyContent(html, 'og:description') ??
      metaNameContent(html, 'twitter:description') ??
      metaNameContent(html, 'description')
    const imageRaw =
      metaPropertyContent(html, 'og:image') ??
      metaNameContent(html, 'twitter:image') ??
      metaNameContent(html, 'twitter:image:src')
    const image = absolutizeUrl(urlParam, imageRaw)
    return NextResponse.json(
      { title: title || null, description: description || null, image: image || null },
      { headers: { 'Cache-Control': 'private, max-age=120' } },
    )
  } catch {
    clearTimeout(timer)
    return NextResponse.json(
      { title: null, description: null, image: null, error: 'fetch_failed' },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    )
  }
}

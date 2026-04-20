import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual, createHmac } from 'crypto'

/**
 * Gate opzionale per la schermata login admin.
 * Imposta `ADMIN_LOGIN_GATE_PIN` (es. 4 cifre) per richiedere il PIN prima di email/password.
 * Se la variabile è assente o vuota, il gate è disattivato.
 *
 * Security:
 *  - HMAC + timingSafeEqual prevents timing attacks (Fix #2)
 *  - In-process rate-limit: max 5 attempts per IP per 15 min (Fix #3)
 *    NOTE: the Map lives in the serverless function instance. On Vercel it
 *    resets on cold starts and is not shared across concurrent instances.
 *    This provides meaningful protection within a warm instance while
 *    degrading safely (counter resets) rather than crashing. For
 *    production-grade limiting add Upstash Redis + @upstash/ratelimit.
 */
const MAX_PIN_LEN = 12

// ── Rate limiter ────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

interface RateLimitEntry { count: number; resetAt: number }
const attempts = new Map<string, RateLimitEntry>()

/** Returns the real client IP, preferring the Vercel/proxy forwarded header. */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

/**
 * Returns true if the request is allowed, false if the IP is rate-limited.
 * Increments the counter on every call (allowed or not) so callers must
 * check BEFORE processing the PIN.
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= MAX_ATTEMPTS) return false
  entry.count++
  return true
}

// ── HMAC helpers ────────────────────────────────────────────────────────────
/** HMAC key derived from a stable server secret so digests are deployment-specific. */
const HMAC_KEY = process.env.ADMIN_LOGIN_GATE_PIN_HMAC_KEY ?? process.env.CRON_SECRET ?? 'fluxo-gate-fallback'

function hmacDigest(value: string): Buffer {
  return Buffer.from(
    createHmac('sha256', HMAC_KEY).update(value).digest()
  )
}

/** Constant-time equality — both HMAC buffers are always 32 bytes. */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(hmacDigest(a), hmacDigest(b))
}

export async function GET() {
  const secret = process.env.ADMIN_LOGIN_GATE_PIN?.trim() ?? ''
  const enabled = secret.length > 0 && secret.length <= MAX_PIN_LEN
  return NextResponse.json({
    enabled,
    /** Allineato alla lunghezza del segreto (max 12) */
    pinLength: enabled ? secret.length : 0,
  })
}

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_LOGIN_GATE_PIN?.trim()
  if (!secret) {
    return NextResponse.json({ ok: true, bypass: true })
  }
  if (secret.length > MAX_PIN_LEN) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  // Rate-limit check — must happen before PIN parsing so a blocked IP gets
  // no information about whether the PIN would have been correct.
  const ip = getClientIp(req)
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Too many attempts. Try again later.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const pin = typeof (body as { pin?: unknown })?.pin === 'string'
    ? (body as { pin: string }).pin.trim()
    : ''

  if (!pin) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  if (!safeEqual(pin, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}

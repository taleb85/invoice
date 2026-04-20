import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual, createHmac } from 'crypto'

/**
 * Gate opzionale per la schermata login admin.
 * Imposta `ADMIN_LOGIN_GATE_PIN` (es. 4 cifre) per richiedere il PIN prima di email/password.
 * Se la variabile è assente o vuota, il gate è disattivato.
 *
 * Security: comparison uses HMAC + timingSafeEqual to prevent timing attacks.
 * Raw pin strings are never compared directly — both sides are HMAC-digested
 * first so the buffers are always the same length (32 bytes), eliminating
 * the early-exit leak that `pin !== secret` would expose.
 */
const MAX_PIN_LEN = 12

/** HMAC key derived from a stable server secret so digests are deployment-specific. */
const HMAC_KEY = process.env.ADMIN_GATE_HMAC_KEY ?? process.env.CRON_SECRET ?? 'fluxo-gate-fallback'

function hmacDigest(value: string): Buffer {
  return Buffer.from(
    createHmac('sha256', HMAC_KEY).update(value).digest()
  )
}

/** Constant-time equality check — both buffers must be the same length. */
function safeEqual(a: string, b: string): boolean {
  const da = hmacDigest(a)
  const db = hmacDigest(b)
  return timingSafeEqual(da, db)
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

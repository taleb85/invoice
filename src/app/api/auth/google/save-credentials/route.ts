import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { isMasterAdminRole } from '@/lib/roles'

/**
 * POST /api/auth/google/save-credentials
 *
 * Saves Gmail OAuth credentials (Client ID + Secret) to `user_settings` in
 * Supabase for the authenticated master-admin user.
 *
 * Security notes:
 *  - Master-admin role required (operatore / admin_sede are rejected).
 *  - Credentials are stored in Supabase only — never written to process.env.
 *    Mutating process.env at runtime would cross-contaminate all subsequent
 *    requests on the same warm serverless instance with this user's secrets.
 *  - The caller must restart / redeploy to pick up env-level overrides; the
 *    Supabase-stored values are read by gmail-service on every request instead.
 */
export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  // Only master admins may change app-level OAuth credentials
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!isMasterAdminRole(profile?.role)) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const client_id: unknown = body?.client_id
    const client_secret: unknown = body?.client_secret

    if (typeof client_id !== 'string' || typeof client_secret !== 'string' ||
        !client_id || !client_secret) {
      return NextResponse.json({
        error: 'Client ID e Client Secret sono obbligatori',
      }, { status: 400 })
    }

    // Basic format validation
    if (!client_id.includes('.apps.googleusercontent.com')) {
      return NextResponse.json({
        error: 'Client ID non valido (deve contenere .apps.googleusercontent.com)',
      }, { status: 400 })
    }

    if (!client_secret.startsWith('GOCSPX-')) {
      return NextResponse.json({
        error: 'Client Secret non valido (deve iniziare con GOCSPX-)',
      }, { status: 400 })
    }

    const savedAt = new Date().toISOString()

    // Persist both values to Supabase — this is the sole source of truth
    const upsertResults = await Promise.all([
      service.from('user_settings').upsert([{
        user_id: user.id,
        setting_key: 'gmail_client_id',
        setting_value: client_id,
        metadata: { saved_at: savedAt, saved_via: 'wizard' },
      }], { onConflict: 'user_id,sede_id,setting_key' }),

      service.from('user_settings').upsert([{
        user_id: user.id,
        setting_key: 'gmail_client_secret',
        setting_value: client_secret,
        metadata: { saved_at: savedAt, saved_via: 'wizard' },
      }], { onConflict: 'user_id,sede_id,setting_key' }),
    ])

    const dbError = upsertResults.find(r => r.error)?.error
    if (dbError) {
      console.error('[GMAIL-SAVE] DB error:', dbError.message)
      return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
    }

    // ── REMOVED: process.env mutation ────────────────────────────────────────
    // Writing to process.env here would inject this user's OAuth secrets into
    // the shared serverless process, making them visible to ALL requests on
    // the same warm instance regardless of which user triggered them.
    // Credentials are read from Supabase (user_settings) on every request by
    // gmail-service — no in-memory env patching needed or wanted.
    // ─────────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      success: true,
      message: 'Credenziali salvate con successo',
      hint: 'Credenziali salvate nel database. Per configurazione statica aggiungi GMAIL_CLIENT_ID e GMAIL_CLIENT_SECRET nelle variabili Vercel.',
    })

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Errore sconosciuto'
    console.error('[GMAIL-SAVE] Unexpected error:', errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

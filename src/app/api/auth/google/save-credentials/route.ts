import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

/**
 * POST /api/auth/google/save-credentials
 * 
 * Saves Gmail API credentials (Client ID and Secret) temporarily in user_settings.
 * This allows users to configure Gmail without having access to .env.local.
 * 
 * NOTE: In production, these should be set at the app level (environment variables),
 * but this endpoint provides a user-friendly setup wizard.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }
  
  try {
    const { client_id, client_secret } = await req.json()
    
    if (!client_id || !client_secret) {
      return NextResponse.json({
        error: 'Client ID e Client Secret sono obbligatori'
      }, { status: 400 })
    }
    
    // Validate format (basic check)
    if (!client_id.includes('.apps.googleusercontent.com')) {
      return NextResponse.json({
        error: 'Client ID non valido (deve terminare con .apps.googleusercontent.com)'
      }, { status: 400 })
    }
    
    if (!client_secret.startsWith('GOCSPX-')) {
      return NextResponse.json({
        error: 'Client Secret non valido (deve iniziare con GOCSPX-)'
      }, { status: 400 })
    }
    
    const service = createServiceClient()
    
    // Save Client ID
    await service.from('user_settings').upsert([{
      user_id: user.id,
      setting_key: 'gmail_client_id',
      setting_value: client_id,
      metadata: {
        saved_at: new Date().toISOString(),
        saved_via: 'wizard',
      },
    }], {
      onConflict: 'user_id,sede_id,setting_key',
    })
    
    // Save Client Secret
    await service.from('user_settings').upsert([{
      user_id: user.id,
      setting_key: 'gmail_client_secret',
      setting_value: client_secret, // In production, encrypt this!
      metadata: {
        saved_at: new Date().toISOString(),
        saved_via: 'wizard',
      },
    }], {
      onConflict: 'user_id,sede_id,setting_key',
    })
    
    console.log(`[GMAIL-SAVE] User ${user.id} saved Gmail credentials via wizard`)
    
    // Update environment variables in-memory for this session
    // NOTE: This is a workaround for runtime - restart required for persistence
    if (typeof process !== 'undefined' && process.env) {
      process.env.GMAIL_CLIENT_ID = client_id
      process.env.GMAIL_CLIENT_SECRET = client_secret
    }
    
    return NextResponse.json({
      success: true,
      message: 'Credenziali salvate con successo',
      hint: 'Per rendere permanente, aggiungi GMAIL_CLIENT_ID e GMAIL_CLIENT_SECRET a .env.local'
    })
    
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Errore sconosciuto'
    console.error('[GMAIL-SAVE] Error:', err)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

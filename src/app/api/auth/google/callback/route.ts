import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { gmailService } from '@/lib/gmail-service'

/**
 * GET /api/auth/google/callback
 * 
 * OAuth2 callback handler for Gmail authentication.
 * Exchanges authorization code for tokens and saves them securely.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  
  // Handle user denial
  if (error) {
    const redirectUrl = new URL('/settings', req.nextUrl.origin)
    redirectUrl.searchParams.set('gmail_error', error)
    return NextResponse.redirect(redirectUrl, { status: 302 })
  }

  // Validate code (redirect HTTP 302 — evita 200 su richieste senza code, vedi QA Vercel)
  if (!code) {
    const redirectUrl = new URL('/settings', req.nextUrl.origin)
    redirectUrl.searchParams.set('gmail_error', 'no_code')
    return NextResponse.redirect(redirectUrl, { status: 302 })
  }
  
  try {
    // Decode state to get user ID
    let userId: string | null = null
    let sedeId: string | null = null
    
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'))
        userId = decoded.user_id
        sedeId = decoded.sede_id || null
      } catch {
        console.warn('[GMAIL-CALLBACK] Failed to decode state parameter')
      }
    }
    
    // Get authenticated user as fallback
    const { user } = await getRequestAuth()
    if (!user) {
      const redirectUrl = new URL('/login', req.nextUrl.origin)
      redirectUrl.searchParams.set('error', 'not_authenticated')
      return NextResponse.redirect(redirectUrl, { status: 302 })
    }

    userId = userId || user.id

    const service = createServiceClient()
    // Get user's sede_id if not provided
    if (!sedeId) {
      const { data: profile } = await service
        .from('profiles')
        .select('sede_id')
        .eq('id', userId)
        .maybeSingle()

      sedeId = profile?.sede_id || null
    }

    // Initialize service for Gmail
    await gmailService.init(service)
    
    // Exchange code for tokens
    const tokens = await gmailService.getTokensFromCode(code)
    
    if (!tokens.refresh_token) {
      console.warn('[GMAIL-CALLBACK] No refresh token received - user may have already authorized')
      // Try to proceed with access token only
      if (!tokens.access_token) {
        throw new Error('No tokens received from Google')
      }
    }
    
    // Save tokens to database
    await gmailService.saveTokens(userId, tokens, sedeId || undefined)
    
    // Get user's email address for confirmation
    const emailAddress = await gmailService.getUserEmail(userId)
    
    console.log(`[GMAIL-CALLBACK] Successfully connected Gmail for user ${userId}: ${emailAddress}`)
    
    // Redirect to settings page with success message
    const redirectUrl = new URL('/settings', req.nextUrl.origin)
    redirectUrl.searchParams.set('gmail_success', '1')
    if (emailAddress) {
      redirectUrl.searchParams.set('gmail_email', emailAddress)
    }
    
    return NextResponse.redirect(redirectUrl, { status: 302 })

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Errore sconosciuto'
    console.error('[GMAIL-CALLBACK] Error:', err)
    
    const redirectUrl = new URL('/settings', req.nextUrl.origin)
    redirectUrl.searchParams.set('gmail_error', 'token_exchange_failed')
    redirectUrl.searchParams.set('gmail_error_detail', errMsg)
    
    return NextResponse.redirect(redirectUrl, { status: 302 })
  }
}

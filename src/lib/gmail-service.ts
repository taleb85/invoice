/**
 * Gmail API Service with Database Token Management
 * 
 * This service manages Gmail API authentication using tokens stored in Supabase.
 * Supports both:
 * - Environment variable tokens (GMAIL_REFRESH_TOKEN) for development
 * - Database-stored tokens (user_settings table) for production multi-user
 * 
 * Token refresh is automatic when access token expires.
 */

import { google } from 'googleapis'
import { createServiceClient } from '@/utils/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

type GoogleOAuth2Client = InstanceType<typeof google.auth.OAuth2>

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  internalDate: string
  subject: string | null
  from: string | null
  to: string | null
  bodyText: string | null
  bodyHtml: string | null
}

export interface GmailTokens {
  access_token?: string
  refresh_token?: string
  expiry_date?: number
  scope?: string
  token_type?: string
}

type GmailPayloadPart = {
  mimeType?: string | null
  body?: { data?: string }
  parts?: GmailPayloadPart[]
}

class GmailService {
  private oauth2Client: GoogleOAuth2Client
  private supabase: SupabaseClient | null = null
  /** Set to true once clientId + clientSecret have been successfully resolved. */
  private _configured = false

  constructor() {
    // Build a placeholder client using the redirect URI only.
    // Credentials (clientId / clientSecret) are resolved in init() — either
    // from env vars (fast path) or from Supabase user_settings (wizard path).
    // This avoids baking potentially-absent env values at construction time.
    this.oauth2Client = new google.auth.OAuth2(
      undefined,
      undefined,
      this._redirectUri()
    )

    // If both env vars are already present, pre-configure now so callers that
    // skip init() (e.g. unit tests, getAuthUrl()) still work.
    if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET) {
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        this._redirectUri()
      )
      this._configured = true
      if (process.env.GMAIL_REFRESH_TOKEN) {
        this.oauth2Client.setCredentials({
          refresh_token: process.env.GMAIL_REFRESH_TOKEN,
        })
      }
    }
  }

  private _redirectUri(): string {
    return process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`
      : 'http://localhost:3000/api/auth/google/callback'
  }

  /**
   * Initialize with a Supabase client for token management.
   *
   * Resolves Gmail OAuth credentials in priority order:
   *  1. GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET env vars (already handled in
   *     constructor — this branch is a fast no-op if already configured)
   *  2. user_settings rows saved via /api/auth/google/save-credentials wizard
   *
   * After Fix #4 the wizard no longer writes to process.env, so this DB
   * fallback is the only way wizard-configured credentials reach the service.
   */
  async init(supabase?: SupabaseClient): Promise<void> {
    this.supabase = supabase ?? createServiceClient()

    // Fast path: env vars resolved in constructor
    if (this._configured) return

    // Fallback: load clientId + clientSecret from Supabase
    let clientId = process.env.GMAIL_CLIENT_ID
    let clientSecret = process.env.GMAIL_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      const { data } = await this.supabase
        .from('user_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['gmail_client_id', 'gmail_client_secret'])
        .limit(2)

      const row = (data ?? []).reduce<Record<string, string>>(
        (acc, r) => ({ ...acc, [r.setting_key as string]: r.setting_value as string }),
        {}
      )
      clientId    = clientId    ?? row['gmail_client_id']
      clientSecret = clientSecret ?? row['gmail_client_secret']
    }

    if (!clientId || !clientSecret) return // not configured — _configured stays false

    // Re-initialize the OAuth2 client with the resolved credentials
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, this._redirectUri())
    this._configured = true

    if (process.env.GMAIL_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      })
    }
  }

  /**
   * Returns true once clientId + clientSecret have been resolved (env or DB).
   * Replaces the old env-only check so wizard-configured deployments work.
   */
  isConfigured(): boolean {
    return this._configured
  }
  
  /**
   * Check if user has connected Gmail account
   */
  async isConnected(userId?: string): Promise<boolean> {
    // Check env variable first (global account)
    if (process.env.GMAIL_REFRESH_TOKEN) {
      return true
    }
    
    // Check database for user-specific token
    if (!userId || !this.supabase) {
      return false
    }
    
    const { data } = await this.supabase
      .from('user_settings')
      .select('setting_value')
      .eq('user_id', userId)
      .eq('setting_key', 'gmail_refresh_token')
      .maybeSingle()
    
    return !!data?.setting_value
  }
  
  /**
   * Get OAuth2 authorization URL
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.labels',
      ],
      prompt: 'consent', // Force to get refresh token
    })
  }
  
  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<GmailTokens> {
    const { tokens } = await this.oauth2Client.getToken(code)
    return tokens as GmailTokens
  }
  
  /**
   * Save tokens to database for a user
   */
  async saveTokens(userId: string, tokens: GmailTokens, sedeId?: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized')
    }
    
    // Save refresh token (long-lived)
    if (tokens.refresh_token) {
      await this.supabase.from('user_settings').upsert([{
        user_id: userId,
        sede_id: sedeId || null,
        setting_key: 'gmail_refresh_token',
        setting_value: tokens.refresh_token, // In production, encrypt this!
        metadata: {
          scope: tokens.scope,
          token_type: tokens.token_type,
          connected_at: new Date().toISOString(),
        },
      }], {
        onConflict: 'user_id,sede_id,setting_key',
      })
    }
    
    // Save access token (short-lived, with expiry)
    if (tokens.access_token) {
      await this.supabase.from('user_settings').upsert([{
        user_id: userId,
        sede_id: sedeId || null,
        setting_key: 'gmail_access_token',
        setting_value: tokens.access_token,
        metadata: {
          expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        },
      }], {
        onConflict: 'user_id,sede_id,setting_key',
      })
    }
  }
  
  /**
   * Load tokens from database for a user
   */
  async loadTokens(userId: string): Promise<GmailTokens | null> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized')
    }
    
    const { data: settings } = await this.supabase
      .from('user_settings')
      .select('setting_key, setting_value, metadata')
      .eq('user_id', userId)
      .in('setting_key', ['gmail_refresh_token', 'gmail_access_token'])
    
    if (!settings || settings.length === 0) {
      return null
    }
    
    const tokens: GmailTokens = {}
    
    for (const setting of settings) {
      if (setting.setting_key === 'gmail_refresh_token') {
        tokens.refresh_token = setting.setting_value
        tokens.scope = setting.metadata?.scope
        tokens.token_type = setting.metadata?.token_type
      } else if (setting.setting_key === 'gmail_access_token') {
        tokens.access_token = setting.setting_value
        if (setting.metadata?.expires_at) {
          tokens.expiry_date = new Date(setting.metadata.expires_at).getTime()
        }
      }
    }
    
    return tokens
  }
  
  /**
   * Set credentials for API calls (from env or database)
   */
  async setCredentials(userId?: string): Promise<void> {
    // Try user-specific tokens first
    if (userId && this.supabase) {
      const tokens = await this.loadTokens(userId)
      if (tokens) {
        this.oauth2Client.setCredentials(tokens)
        return
      }
    }
    
    // Fallback to environment variable (global account)
    if (process.env.GMAIL_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      })
    }
  }
  
  /**
   * Revoke access for a user
   */
  async disconnect(userId: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized')
    }
    
    // Delete tokens from database
    await this.supabase
      .from('user_settings')
      .delete()
      .eq('user_id', userId)
      .in('setting_key', ['gmail_refresh_token', 'gmail_access_token'])
  }
  
  /**
   * Get user's email address from Gmail API
   */
  async getUserEmail(userId?: string): Promise<string | null> {
    try {
      await this.setCredentials(userId)
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
      const response = await gmail.users.getProfile({ userId: 'me' })
      return response.data.emailAddress || null
    } catch (err) {
      console.error('[GMAIL] Error getting user email:', err)
      return null
    }
  }
  
  /**
   * Search for unread emails from orders@rekki.com
   */
  async searchRekkiOrderEmails(maxResults = 10, userId?: string): Promise<string[]> {
    if (!this.isConfigured()) {
      throw new Error('Gmail API not configured. Add credentials to .env.local')
    }
    
    await this.setCredentials(userId)
    
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
    
    const query = 'from:orders@rekki.com is:unread newer_than:7d'
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    })
    
    return response.data.messages?.map(m => m.id as string) || []
  }
  
  /**
   * Get full email message by ID
   */
  async getMessage(messageId: string, userId?: string): Promise<GmailMessage | null> {
    if (!this.isConfigured()) {
      throw new Error('Gmail API not configured')
    }
    
    await this.setCredentials(userId)
    
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    })
    
    const message = response.data
    if (!message) return null
    
    // Extract headers
    const headers = message.payload?.headers || []
    const getHeader = (name: string) =>
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || null
    
    // Extract body (text/html)
    let bodyText: string | null = null
    let bodyHtml: string | null = null
    
    const extractBody = (part: GmailPayloadPart): void => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8')
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8')
      }
      if (part.parts) {
        part.parts.forEach(extractBody)
      }
    }
    
    if (message.payload) {
      extractBody(message.payload as GmailPayloadPart)
    }
    
    return {
      id: message.id as string,
      threadId: message.threadId as string,
      labelIds: message.labelIds || [],
      snippet: message.snippet || '',
      internalDate: message.internalDate || '',
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      bodyText,
      bodyHtml,
    }
  }
  
  /**
   * Mark email as read
   */
  async markAsRead(messageId: string, userId?: string): Promise<void> {
    if (!this.isConfigured()) return
    
    await this.setCredentials(userId)
    
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    })
  }
  
  /**
   * Add label to email
   */
  async addLabel(messageId: string, labelName: string, userId?: string): Promise<void> {
    if (!this.isConfigured()) return
    
    await this.setCredentials(userId)
    
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
    
    // Get or create label
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' })
    let label = labelsResponse.data.labels?.find(l => l.name === labelName)
    
    if (!label) {
      const createResponse = await gmail.users.labels.create({
        userId: 'me',
        requestBody: { name: labelName },
      })
      label = createResponse.data
    }
    
    if (!label?.id) return
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [label.id],
      },
    })
  }
}

// Singleton instance
export const gmailService = new GmailService()

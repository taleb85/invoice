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

class GmailService {
  private oauth2Client: any
  private supabase: SupabaseClient | null = null
  
  constructor() {
    const redirectUri = process.env.NEXT_PUBLIC_SITE_URL 
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`
      : 'http://localhost:3000/api/auth/google/callback'
    
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      redirectUri
    )
    
    // Set refresh token if available in env (fallback for development)
    if (process.env.GMAIL_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      })
    }
  }
  
  /**
   * Initialize with Supabase client for token management
   */
  async init(supabase?: SupabaseClient) {
    this.supabase = supabase || createServiceClient()
  }
  
  /**
   * Check if Gmail API credentials are configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET
    )
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
    return tokens
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
    
    const extractBody = (part: any): void => {
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
      extractBody(message.payload)
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

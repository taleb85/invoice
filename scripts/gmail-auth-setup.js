#!/usr/bin/env node

/**
 * Gmail API OAuth2 Setup Script
 * 
 * This script helps you obtain the refresh token needed for Gmail API access.
 * 
 * Steps:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project or select existing one
 * 3. Enable Gmail API
 * 4. Create OAuth2 credentials (Web application)
 * 5. Add authorized redirect URI: http://localhost:3000
 * 6. Download credentials and add to .env.local:
 *    GMAIL_CLIENT_ID=your_client_id
 *    GMAIL_CLIENT_SECRET=your_secret
 * 7. Run this script: node scripts/gmail-auth-setup.js
 * 8. Copy the refresh token to .env.local:
 *    GMAIL_REFRESH_TOKEN=your_refresh_token
 */

const { google } = require('googleapis')
const http = require('http')
const url = require('url')
const open = require('open')
const readline = require('readline')

// Load from .env.local
require('dotenv').config({ path: '.env.local' })

const CLIENT_ID = process.env.GMAIL_CLIENT_ID
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3000'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
]

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Error: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env.local')
  console.error('\nPlease:')
  console.error('1. Go to https://console.cloud.google.com/')
  console.error('2. Enable Gmail API')
  console.error('3. Create OAuth2 credentials')
  console.error('4. Add them to .env.local')
  process.exit(1)
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
)

async function getAccessToken() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force to get refresh token
  })

  console.log('\n🔐 Gmail API OAuth2 Setup\n')
  console.log('1. Opening browser for authorization...')
  console.log('2. Grant access to your Gmail account')
  console.log('3. You\'ll be redirected to localhost:3000')
  console.log('\n')

  // Open browser
  await open(authUrl)

  // Start local server to receive callback
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url.indexOf('/') > -1) {
          const qs = new url.URL(req.url, REDIRECT_URI).searchParams
          const code = qs.get('code')

          if (!code) {
            res.end('❌ No authorization code received. Please try again.')
            server.close()
            reject(new Error('No authorization code'))
            return
          }

          res.end('✅ Authorization successful! You can close this window and return to the terminal.')

          // Exchange code for tokens
          const { tokens } = await oauth2Client.getToken(code)
          oauth2Client.setCredentials(tokens)

          server.close()
          resolve(tokens)
        }
      } catch (err) {
        reject(err)
      }
    }).listen(3000, () => {
      console.log('📡 Local server started on http://localhost:3000')
      console.log('   Waiting for authorization...\n')
    })
  })
}

async function main() {
  try {
    const tokens = await getAccessToken()

    console.log('\n✅ Authorization successful!\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Add this to your .env.local file:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    if (!tokens.refresh_token) {
      console.warn('⚠️  Warning: No refresh token received.')
      console.warn('   This might happen if you\'ve authorized this app before.')
      console.warn('   To fix:')
      console.warn('   1. Go to https://myaccount.google.com/permissions')
      console.warn('   2. Remove this app')
      console.warn('   3. Run this script again')
    }

    console.log('✅ Setup complete! Your app can now access Gmail API.')
    console.log('\nNext steps:')
    console.log('1. Add the refresh token to .env.local')
    console.log('2. Restart your development server')
    console.log('3. The cron job will automatically poll for Rekki emails\n')

  } catch (err) {
    console.error('\n❌ Error during setup:', err.message)
    process.exit(1)
  }
}

main()

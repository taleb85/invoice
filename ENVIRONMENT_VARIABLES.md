# Smart Pair — Environment Variables

This document lists all environment variables required to run and deploy the Smart Pair app.

---

## Required (app will not start without these)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (public) | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (secret — never expose client-side) | `eyJ...` |
| `OPENAI_API_KEY` | OpenAI API key for OCR/GPT-4o invoice scanning | `sk-...` |

---

## Required for production features

| Variable | Description | Example |
|----------|-------------|---------|
| `CRON_SECRET` | Secret token used to authenticate Vercel cron jobs hitting `/api/cron/*`. Must match the `Authorization: Bearer <secret>` header. | `a-random-64-char-string` |
| `NEXT_PUBLIC_SITE_URL` | Full public URL of the deployed app (no trailing slash). Used for cron self-calls and absolute links in emails. | `https://app.smart-pair.io` |
| `RESEND_API_KEY` | Resend API key for transactional emails (solleciti, richieste, onboarding) | `re_...` |

---

## PWA Push Notifications

Generate VAPID keys with:
```bash
node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log('PUBLIC:', k.publicKey, '\nPRIVATE:', k.privateKey)"
```

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key for push subscription (public, used client-side) | `BEl62...` |
| `VAPID_PRIVATE_KEY` | VAPID private key (secret — server-side only) | `abc123...` |
| `VAPID_SUBJECT` | Contact email or URL for VAPID identification | `mailto:admin@smart-pair.io` |

---

## Optional integrations

| Variable | Description | Default |
|----------|-------------|---------|
| `COMPANIES_HOUSE_API_KEY` | Companies House (UK) API key for UK VAT number lookups in `/api/vat-lookup`. Leave empty to skip UK lookups. | _(empty)_ |
| `REKKI_API_KEY` | Rekki marketplace API key for order sync and price list import | _(empty)_ |
| `REKKI_SUPPLIERS_SEARCH_URL` | Rekki suppliers search endpoint URL | _(empty)_ |
| `OCR_VISION_CONCURRENCY` | Max parallel GPT-4o OCR calls during email scan (default: 3) | `3` |

---

## Admin login gate (optional security layer)

| Variable | Description |
|----------|-------------|
| `ADMIN_LOGIN_GATE_PIN` | Optional PIN that must be entered before the admin login form is shown. Leave unset to disable gate. |
| `ADMIN_LOGIN_GATE_PIN_HMAC_KEY` | HMAC secret for signing the gate cookie. Required if `ADMIN_LOGIN_GATE_PIN` is set. |

---

## Gmail OAuth (optional — alternative to IMAP for email scanning)

| Variable | Description |
|----------|-------------|
| `GMAIL_CLIENT_ID` | Google OAuth client ID for Gmail API access |
| `GMAIL_CLIENT_SECRET` | Google OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | OAuth refresh token (obtained via OAuth flow) |

---

## Legacy IMAP fallback (deprecated — use per-sede IMAP settings instead)

> These global IMAP variables are superseded by per-sede IMAP configuration stored in the `sedi` table. Only needed if running the legacy single-sede setup.

| Variable | Description |
|----------|-------------|
| `IMAP_HOST` | IMAP server hostname |
| `IMAP_PORT` | IMAP port (usually 993 for SSL) |
| `IMAP_USER` | IMAP username / email address |
| `IMAP_PASSWORD` | IMAP password or app password |

---

## Vercel Cron Schedule

Configured in `vercel.json`:

| Route | Schedule | Description |
|-------|----------|-------------|
| `/api/cron/rekki-auto-poll` | `0 9 * * *` | Daily at 09:00 UTC — sync Rekki orders |
| `/api/cron/auto-process-invoices` | `0 10 * * *` | Daily at 10:00 UTC — auto-process pending email documents |
| `/api/cron/backup` | `0 2 * * 1` | Weekly Monday at 02:00 UTC — CSV backup of critical tables |

---

## Local development (.env.local)

```bash
# Core Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Cron auth (any random string locally)
CRON_SECRET=dev-secret-change-in-production

# PWA Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:dev@example.com

# Optional
RESEND_API_KEY=
COMPANIES_HOUSE_API_KEY=
REKKI_API_KEY=
```

---

## Vercel Dashboard Checklist

Make sure these are set in **Settings → Environment Variables** on Vercel:

- [x] `NEXT_PUBLIC_SUPABASE_URL`
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] `SUPABASE_SERVICE_ROLE_KEY`
- [x] `OPENAI_API_KEY`
- [x] `NEXT_PUBLIC_SITE_URL`
- [x] `CRON_SECRET`
- [x] `RESEND_API_KEY`
- [x] `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- [x] `VAPID_PRIVATE_KEY`
- [x] `VAPID_SUBJECT`
- [ ] `COMPANIES_HOUSE_API_KEY` _(optional — leave empty for IT-only deployments)_
- [ ] `REKKI_API_KEY` _(optional — only if Rekki integration is active)_

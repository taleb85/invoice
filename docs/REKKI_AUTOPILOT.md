# Rekki Autopilot - Full Automation Guide

## Overview

The Rekki Autopilot system automatically monitors, processes, and audits Rekki order confirmation emails without any manual intervention.

## System Architecture

```
Gmail Inbox (orders@rekki.com)
        ↓
   [Every 15 min]
        ↓
  Gmail API Polling
        ↓
Parse & Extract Products
        ↓
    ┌───────┴───────┐
    ↓               ↓
Auto-Update    Create Statement
  Listino      (Triple-Check)
    ↓               ↓
Notification  Compare vs Invoices
              (Every hour)
                ↓
          Flag Anomalies
```

## Components

### 1. Gmail API Service (`/lib/gmail-service.ts`)
- Authenticates with Gmail using OAuth2
- Searches for unread emails from `orders@rekki.com`
- Fetches full message content (subject, body, HTML)
- Marks processed emails as read
- Applies labels for organization

### 2. Auto-Poll Cron Job (`/api/cron/rekki-auto-poll`)
- **Schedule**: Every 15 minutes
- **Function**: Fetches and processes new Rekki order emails
- **Actions**:
  1. Search for unread emails from `orders@rekki.com`
  2. Parse products, quantities, and prices
  3. Update `listino_prezzi` automatically
  4. Create statement for triple-check
  5. Record in `rekki_auto_orders` table
  6. Mark email as read and label it

### 3. Auto-Invoice Check Cron Job (`/api/cron/auto-process-invoices`)
- **Schedule**: Every hour
- **Function**: Compares new invoices with Rekki orders
- **Actions**:
  1. Find invoices uploaded in last 24 hours
  2. Extract line items from invoices
  3. Compare with latest Rekki order prices
  4. Flag anomalies (invoice price > Rekki price by >5%)
  5. Log discrepancies in `log_sincronizzazione`

### 4. UI Component (`/components/RekkiOrdersAutoList.tsx`)
- Displays automatically processed orders
- Shows price changes (old → new)
- Real-time updates via Supabase subscriptions
- Manual trigger button for immediate polling
- Expandable details for each order

## Setup Instructions

### Prerequisites
- Google Cloud Project with Gmail API enabled
- OAuth2 credentials (Web application)
- Vercel account (for cron jobs)

### Step 1: Enable Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to "APIs & Services" > "Library"
4. Search for "Gmail API" and enable it
5. Go to "APIs & Services" > "Credentials"
6. Click "Create Credentials" > "OAuth client ID"
7. Choose "Web application"
8. Add authorized redirect URI: `http://localhost:3000`
9. Download credentials

### Step 2: Configure Environment Variables

Add to `.env.local`:

```bash
# Gmail API Credentials
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REFRESH_TOKEN=your_refresh_token_here

# Cron Security
CRON_SECRET=your_random_secret_string

# Site URL (for API calls from cron)
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

### Step 3: Obtain Refresh Token

Run the setup script:

```bash
npm install googleapis open dotenv
node scripts/gmail-auth-setup.js
```

This will:
1. Open your browser for Gmail authorization
2. Prompt you to grant access
3. Display your refresh token
4. Add it to `.env.local`

### Step 4: Run Database Migration

```bash
npx supabase db push
```

This creates the `rekki_auto_orders` table.

### Step 5: Deploy to Vercel

The `vercel.json` file already configures the cron jobs:

```json
{
  "crons": [
    {
      "path": "/api/cron/rekki-auto-poll",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/auto-process-invoices",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Deploy:**

```bash
vercel --prod
```

### Step 6: Add Environment Variables to Vercel

```bash
vercel env add GMAIL_CLIENT_ID
vercel env add GMAIL_CLIENT_SECRET
vercel env add GMAIL_REFRESH_TOKEN
vercel env add CRON_SECRET
vercel env add NEXT_PUBLIC_SITE_URL
```

## How It Works

### Automatic Order Processing

1. **Email Arrives** from `orders@rekki.com`
2. **Cron Triggers** (every 15 minutes)
3. **Gmail API** fetches unread emails
4. **Parser** extracts:
   - Product names
   - Quantities
   - Unit prices
5. **Listino Update**:
   - Existing products → Update price with current date
   - New products → Create entry automatically
6. **Statement Creation** for triple-check
7. **Email Marked** as read with "Rekki/Processed" label
8. **Record Saved** in `rekki_auto_orders`

### Silent Update Logic

When a Rekki order is processed:

```typescript
// If product exists in listino
if (existing) {
  await supabase
    .from('listino_prezzi')
    .update({
      prezzo: line.prezzo_unitario,
      data_prezzo: today,
      note: '[AUTO] Aggiornato da conferma Rekki',
    })
    .eq('id', existing.id)
}

// If new product
else {
  await supabase
    .from('listino_prezzi')
    .insert([{
      fornitore_id,
      prodotto: line.prodotto,
      prezzo: line.prezzo_unitario,
      note: '[AUTO] Creato da conferma Rekki',
    }])
}
```

### Automatic Invoice Auditing

1. **Hourly Check** for new invoices
2. **Extract** line items from PDF
3. **Compare** with latest Rekki order
4. **Calculate** price delta:
   ```typescript
   delta = ((invoicePrice - rekkiPrice) / rekkiPrice) * 100
   ```
5. **Flag Anomaly** if `delta > 5%`
6. **Log** in `log_sincronizzazione`:
   ```
   Anomalie prezzi: INV-12345
   - Salmon fillet: Fattura £12.50 vs Rekki £11.80 (+5.9%)
   - Tomatoes: Fattura £4.50 vs Rekki £4.20 (+7.1%)
   ```

## Database Schema

### `rekki_auto_orders`

```sql
CREATE TABLE rekki_auto_orders (
  id uuid PRIMARY KEY,
  fornitore_id uuid NOT NULL,
  sede_id uuid,
  email_message_id text NOT NULL UNIQUE,
  email_subject text,
  email_received_at timestamptz,
  processed_at timestamptz DEFAULT now(),
  products_extracted integer,
  products_updated integer,
  products_created integer,
  statement_id uuid,
  status text CHECK (status IN ('processing', 'completed', 'error')),
  error_message text,
  metadata jsonb
);
```

**Indexes:**
- `fornitore_id, processed_at DESC`
- `email_message_id` (unique)
- `status, processed_at DESC`

## UI Features

### Automatic Orders List

Located under "Integrazione Rekki" on supplier detail page:

- **Real-time updates** via Supabase subscriptions
- **Expandable cards** showing:
  - Email subject
  - Time received
  - Products extracted/updated/created
  - Price changes (old → new)
- **Manual trigger** button for immediate check
- **Status badges**: ✓ OK, ⚠ Errore
- **Last poll time** display

### Manual Trigger

Users can click "Controlla ora" to:
- Immediately poll Gmail
- Process any new emails
- See results in real-time
- Useful for testing or urgent updates

## Security

### Authentication
- Gmail API uses OAuth2 with refresh tokens
- No password storage
- Tokens encrypted in environment variables

### Authorization
- Cron endpoints protected by `CRON_SECRET`
- Bearer token or query parameter authentication
- RLS policies on `rekki_auto_orders` table

### Privacy
- Emails marked as read after processing
- No email content stored (only metadata)
- Labels applied for organization

## Monitoring

### Check Cron Status

Vercel Dashboard > Your Project > Deployments > Logs

Filter by:
- `[REKKI-AUTO]` for order processing
- `[AUTO-INVOICE]` for invoice checks

### Manual Test

```bash
# Test order polling
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/rekki-auto-poll

# Test invoice processing
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/auto-process-invoices
```

### Database Queries

```sql
-- Recent automatic orders
SELECT 
  email_subject,
  processed_at,
  products_updated,
  products_created,
  status
FROM rekki_auto_orders
WHERE fornitore_id = 'YOUR_FORNITORE_ID'
ORDER BY processed_at DESC
LIMIT 20;

-- Price anomalies logged
SELECT 
  created_at,
  oggetto_mail,
  errore_dettaglio
FROM log_sincronizzazione
WHERE 
  mittente = 'auto-invoice-check'
  AND fornitore_id = 'YOUR_FORNITORE_ID'
ORDER BY created_at DESC;
```

## Troubleshooting

### No Emails Detected

**Check:**
1. Gmail API credentials valid?
2. Refresh token not expired?
3. Email actually from `orders@rekki.com`?
4. Email already processed? (check `rekki_auto_orders`)

**Fix:**
```bash
node scripts/gmail-auth-setup.js
# Re-authorize and update refresh token
```

### Cron Jobs Not Running

**Check:**
1. Vercel cron jobs enabled in project settings
2. `vercel.json` committed and deployed
3. `CRON_SECRET` set in Vercel environment

**Fix:**
```bash
vercel env ls
# Verify all environment variables present
```

### Wrong Supplier Matched

**Current limitation**: First Rekki-linked supplier is used.

**Improvement needed**: Parse supplier name from email or implement better matching heuristic.

**Workaround**: Ensure only one supplier has Rekki configured at a time.

### Price Not Updated

**Check:**
1. Product name matching (case-insensitive, normalized)
2. `listino_prezzi` entry exists for supplier
3. No database errors in logs

**Debug:**
```sql
SELECT * FROM listino_prezzi 
WHERE fornitore_id = 'YOUR_ID'
  AND LOWER(TRIM(prodotto)) = LOWER(TRIM('Product Name'));
```

## Benefits

### Time Savings
- **Before**: 15-30 minutes per order (manual entry)
- **After**: 0 minutes (fully automatic)
- **ROI**: ~10 hours/month saved for 20 orders

### Accuracy
- **Eliminates** manual typos
- **Ensures** latest prices used
- **Tracks** all price changes

### Audit Trail
- **Complete history** in `rekki_auto_orders`
- **Automatic flagging** of discrepancies
- **Financial reporting** ready

### Compliance
- **Proof** of agreed prices (Rekki emails)
- **Documentation** of overcharges
- **Dispute resolution** evidence

## Limitations

1. **Single Gmail Account**: Only one inbox monitored
2. **Supplier Matching**: Basic (first Rekki supplier)
3. **Email Format**: Depends on Rekki's format staying consistent
4. **API Quotas**: Gmail API has daily limits
5. **Vercel Cron**: Limited to 1 cron per hour on Hobby plan

## Future Enhancements

- [ ] Multi-supplier email routing
- [ ] Slack/Teams notifications for anomalies
- [ ] Dashboard widget for auto-processed orders
- [ ] ML-based product name matching
- [ ] Webhook alternative to polling
- [ ] Multi-inbox support (per-sede Gmail)
- [ ] Auto-reply to supplier for overcharges
- [ ] Integration with accounting software

## Cost Estimate

### Gmail API
- **Free tier**: 1 billion quota units/day
- **Typical usage**: ~1000 units/day (well within free tier)

### Vercel Cron
- **Pro plan**: $20/month (required for cron)
- **Cron executions**: Unlimited

### Total: $20/month

**Break-even**: Saves 10 hours/month @ $20/hr = $200 value

## Support

For issues:
1. Check logs in Vercel dashboard
2. Review `log_sincronizzazione` table
3. Test manually with "Controlla ora" button
4. Re-run Gmail auth setup if needed

---

**Last Updated**: 2026-04-17  
**Version**: 1.0.0

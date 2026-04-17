# Rekki Autopilot - Quick Start Guide

## What's New?

Your Rekki integration is now **fully automated**! The system:
- ✅ Monitors Gmail for new Rekki order emails every 15 minutes
- ✅ Automatically updates your price list
- ✅ Compares invoices with Rekki orders hourly
- ✅ Flags price discrepancies automatically
- ✅ NO MANUAL INPUT REQUIRED

## Setup (One-Time, 10 Minutes)

### 1. Enable Gmail API

```bash
# Visit Google Cloud Console
https://console.cloud.google.com/

# Steps:
1. Create project or select existing
2. Enable "Gmail API"
3. Create OAuth2 credentials (Web application)
4. Add redirect URI: http://localhost:3000
5. Download credentials
```

### 2. Configure Environment

Add to `.env.local`:

```bash
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_secret
CRON_SECRET=random_secret_string_here
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

### 3. Get Refresh Token

```bash
npm install googleapis open dotenv
node scripts/gmail-auth-setup.js
```

Follow browser prompts, then add the refresh token to `.env.local`:

```bash
GMAIL_REFRESH_TOKEN=your_refresh_token
```

### 4. Run Migration

```bash
npx supabase db push
```

### 5. Deploy to Vercel

```bash
# Add environment variables
vercel env add GMAIL_CLIENT_ID
vercel env add GMAIL_CLIENT_SECRET
vercel env add GMAIL_REFRESH_TOKEN
vercel env add CRON_SECRET
vercel env add NEXT_PUBLIC_SITE_URL

# Deploy
vercel --prod
```

## How to Use

### On Supplier Page

Go to any Rekki-linked supplier (e.g., Berkmann Wine Cellars):

1. **"Ordini Rekki Automatici"** section shows:
   - All automatically processed orders
   - Price changes (old → new)
   - Real-time updates
   - Expandable details

2. **"Controlla ora"** button:
   - Manually trigger email check
   - Useful for testing
   - See results immediately

### Automatic Processing

**Every 15 Minutes:**
- System checks Gmail for `orders@rekki.com`
- Parses products, quantities, prices
- Updates `listino_prezzi` automatically
- Creates statement for triple-check
- Marks email as read

**Every Hour:**
- Scans new invoices (last 24h)
- Compares with Rekki orders
- Flags price discrepancies >5%
- Logs anomalies for review

### View Anomalies

Go to **Audit Prezzi** tab on supplier page:
- See all overcharges (invoice > Rekki)
- Calculate total "waste"
- Export to CSV

## Files Changed/Created

### New Files
- `src/lib/gmail-service.ts` - Gmail API integration
- `src/app/api/cron/rekki-auto-poll/route.ts` - Email polling cron
- `src/app/api/cron/auto-process-invoices/route.ts` - Invoice audit cron
- `src/components/RekkiOrdersAutoList.tsx` - UI for auto-orders
- `supabase/migrations/20260417_create_rekki_auto_orders.sql` - DB schema
- `scripts/gmail-auth-setup.js` - OAuth2 setup helper
- `vercel.json` - Cron configuration
- `docs/REKKI_AUTOPILOT.md` - Full documentation

### Modified Files
- `src/app/(app)/fornitori/[id]/fornitore-detail-client.tsx` - UI integration
- `package.json` - Added dependencies: `googleapis`, `date-fns`, `open`

## Testing

### 1. Test Gmail Connection

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/rekki-auto-poll
```

Expected response:
```json
{
  "messagesFound": 0,
  "messagesProcessed": 0,
  "message": "No new Rekki emails found"
}
```

### 2. Test Invoice Processing

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/auto-process-invoices
```

### 3. Check UI

1. Open supplier page
2. Scroll to "Ordini Rekki Automatici"
3. Click "Controlla ora"
4. See results in real-time

## Monitoring

### Vercel Dashboard

```
Project > Deployments > Logs
Filter by: [REKKI-AUTO] or [AUTO-INVOICE]
```

### Database Queries

```sql
-- Recent automatic orders
SELECT * FROM rekki_auto_orders
WHERE fornitore_id = 'YOUR_ID'
ORDER BY processed_at DESC
LIMIT 10;

-- Price anomalies
SELECT * FROM log_sincronizzazione
WHERE mittente = 'auto-invoice-check'
ORDER BY created_at DESC;
```

## Troubleshooting

### "Gmail API not configured"
- Check `.env.local` has all 3 Gmail variables
- Run `node scripts/gmail-auth-setup.js` again
- Verify refresh token not expired

### "No emails detected"
- Ensure email is from `orders@rekki.com`
- Check if already processed (see `rekki_auto_orders`)
- Verify Gmail API quota not exceeded

### "Cron not running"
- Check `vercel.json` is deployed
- Verify `CRON_SECRET` in Vercel env
- Enable cron in Vercel project settings

## Cost

- **Gmail API**: Free (within quota)
- **Vercel Pro**: $20/month (required for cron)
- **Total**: $20/month

**ROI**: Saves ~10 hours/month @ $20/hr = $200 value

## Support

Full documentation: `docs/REKKI_AUTOPILOT.md`

For issues:
1. Check Vercel logs
2. Review `log_sincronizzazione` table
3. Test with "Controlla ora" button
4. Re-run Gmail auth if needed

---

**Status**: ✅ Production Ready  
**Last Updated**: 2026-04-17

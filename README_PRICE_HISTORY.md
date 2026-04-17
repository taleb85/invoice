# Rekki Price History Recovery - Quick Start

## What It Does

Scans all historical Rekki order emails to find overcharges and potential refunds.

**Example Result:**
```
📧 Scanned: 45 emails over 2 years
📦 Found: 120 products with 380 price occurrences
💰 Potential Refund: £145.50
```

## How to Use

### Step 1: Open Supplier Page

Navigate to a Rekki-linked supplier (e.g., Berkmann Wine Cellars).

### Step 2: Click "Sincronizza Storico"

Scroll to "Cronologia Prezzi Storica" section (orange border).

Click the button and confirm the scan.

### Step 3: Wait ~2 Minutes

The system will:
- Search Gmail for all Rekki emails
- Extract prices from each email
- Compare with invoices
- Calculate refunds

### Step 4: Review Results

Three tabs:

**1. Riepilogo**
- High-level summary
- Total potential refund
- Date range scanned

**2. Prezzi Più Bassi**
- Lowest historical price per product
- Compare with current listino
- Potential savings if renegotiate

**3. Rimborsi Potenziali**
- Invoices where you overpaid
- Delta between invoice and email price
- Total refund per invoice

### Step 5: Export & Request Refund

1. Click "Esporta CSV" on Refunds tab
2. Email CSV to supplier
3. Reference Rekki order emails as proof
4. Request credit note for total amount

## Example Email to Supplier

```
Subject: Request for Credit Note - Price Discrepancies

Dear [Supplier Name],

We've identified pricing discrepancies between your invoices and 
the prices confirmed via Rekki order confirmations.

Attached is a CSV report showing:
- Invoice numbers
- Products affected
- Prices confirmed via Rekki
- Prices actually charged
- Total overcharge: £145.50

Please review and issue a credit note for this amount.

We can provide the original Rekki confirmation emails if needed.

Best regards,
[Your Name]
```

## Features

### Smart Product Matching
- Case-insensitive
- Ignores extra spaces
- Fuzzy matching

### Duplicate Prevention
- Same email won't be scanned twice
- Efficient storage

### Evidence Links
- Each price links back to Gmail message
- Can verify source anytime

## Requirements

- Gmail API configured (same as auto-poll)
- Rekki supplier integration enabled
- Historical emails in Gmail (up to 2 years)

## Tips

### 1. Run Regularly
- **Monthly**: Active suppliers
- **Quarterly**: Occasional suppliers
- **Pre-audit**: Compliance check

### 2. Verify Before Disputing
- Check original email
- Confirm product matches
- Verify no authorized price changes

### 3. Use for Negotiations
- Show historical lows
- Request return to previous prices
- Leverage data in discussions

## Limitations

- **Max 200 emails** per scan (configurable)
- **2 years lookback** (Gmail retention dependent)
- **Fuzzy matching** (may miss renamed products)
- **Manual review** recommended before disputes

## Troubleshooting

**No emails found?**
- Check supplier name matches email content
- Increase lookback period
- Verify Gmail has the emails

**Wrong products matched?**
- Standardize product names in listino
- Use `rekki_product_id` for exact matching

**Scan times out?**
- Reduce max_emails to 100
- Scan in chunks (6 months at a time)

## Cost

**Free!**
- Uses existing Gmail API
- No additional quota needed
- ~20,000 scans/day possible

**ROI**: Infinite (no cost, pure savings)

## Support

Full documentation: `docs/REKKI_PRICE_HISTORY_RECOVERY.md`

For setup: `README_REKKI_AUTOPILOT.md` (Gmail API)

---

**Quick Win**: Run once, find £50-200 in overcharges, request refund. 🎯

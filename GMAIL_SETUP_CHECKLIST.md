# 🎯 Gmail API Setup - Visual Checklist

## Quick Visual Guide

Use this as a companion to `INSTRUCTIONS_GOOGLE_API.md` with visual checkpoints.

---

## ✅ Step-by-Step Checklist

### 🔵 PARTE 1: Google Cloud Console (5 minuti)

#### ☐ Step 1: Crea Progetto
```
https://console.cloud.google.com/
→ "Nuovo Progetto"
→ Nome: "Invoice Rekki App"
→ "Crea"
→ Seleziona progetto
```

**Visual Check**: Vedi il nome progetto in alto a sinistra? ✅

---

#### ☐ Step 2: Abilita Gmail API
```
Menu laterale → "API e servizi" → "Libreria"
→ Cerca: "Gmail API"
→ Click sul risultato
→ "Abilita"
```

**Visual Check**: Vedi "API abilitata" con checkmark verde? ✅

---

#### ☐ Step 3: Configura OAuth Consent Screen
```
"API e servizi" → "Schermata consenso OAuth"
→ "Esterno" → "Crea"

Pagina 1 (Info App):
  Nome app: Invoice Rekki Scanner
  Email assistenza: your-email@gmail.com
  Email sviluppatore: your-email@gmail.com
  → "Salva e continua"

Pagina 2 (Scopes):
  → "Aggiungi o rimuovi ambiti"
  Seleziona:
    ☑ .../auth/gmail.readonly
    ☑ .../auth/gmail.modify  
    ☑ .../auth/gmail.labels
  → "Aggiorna" → "Salva e continua"

Pagina 3 (Test Users):
  → "Aggiungi utenti"
  → your-email@gmail.com (Osteria Basilico)
  → "Aggiungi" → "Salva e continua"

Pagina 4 (Summary):
  → "Torna alla dashboard"
```

**Visual Check**: Dashboard mostra "Schermata consenso OAuth: Configurata"? ✅

---

#### ☐ Step 4: Crea OAuth2 Credentials
```
"API e servizi" → "Credenziali"
→ "+ Crea credenziali" → "ID client OAuth"

Tipo: Applicazione web
Nome: Invoice Rekki Web Client

URI di reindirizzamento autorizzati:
  → "+ Aggiungi URI"
  → http://localhost:3000/api/auth/google/callback
  → "+ Aggiungi URI"
  → https://your-domain.vercel.app/api/auth/google/callback

→ "Crea"
```

**⚠️ CRITICAL**: Popup con credenziali appare!

**COPIA QUESTI VALORI IMMEDIATAMENTE**:
```
ID client: 123456789-abcdefg.apps.googleusercontent.com
Segreto client: GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

**Visual Check**: Hai copiato entrambi i valori? ✅

---

### 🟢 PARTE 2: Configurazione Locale (2 minuti)

#### ☐ Step 5: Aggiungi a .env.local
```bash
# Apri file .env.local
# Aggiungi queste righe (sostituisci con i tuoi valori):

GMAIL_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Visual Check**: File salvato? ✅

---

#### ☐ Step 6: Riavvia Dev Server
```bash
# Terminal:
Ctrl+C (stop server)
npm run dev (restart)
```

**Visual Check**: Server mostra "Ready in XXXms"? ✅

---

### 🟣 PARTE 3: Connetti Gmail nell'App (1 minuto)

#### ☐ Step 7: Autorizza nell'App
```
1. Apri: http://localhost:3000
2. Login con tuo account
3. Vai su: Impostazioni (sidebar)
4. Cerca widget blu "Connetti il tuo account Gmail"
5. Click "Connetti Gmail"
```

**Visual Check**: Redirected to Google? ✅

---

#### ☐ Step 8: Autorizza su Google
```
Schermata Google:
1. Seleziona account Gmail (Osteria Basilico)
2. Se appare "App non verificata":
   → "Avanzate"
   → "Vai a Invoice Rekki Scanner (non sicuro)"
3. Seleziona tutte le autorizzazioni:
   ☑ Visualizzare i messaggi email
   ☑ Gestire etichette email
   ☑ Modificare email
4. Click "Continua"
```

**Visual Check**: Redirected back to app? ✅

---

#### ☐ Step 9: Verifica Connessione
```
Pagina Impostazioni:
  Widget diventa VERDE ✅
  Mostra: "Gmail connesso"
  Email: your-email@gmail.com
```

**Visual Check**: Widget verde con email address? ✅

---

### 🧪 PARTE 4: Test Funzionalità (2 minuti)

#### ☐ Test 1: Status API
```bash
curl http://localhost:3000/api/auth/google/status

# Expected:
{
  "configured": true,
  "connected": true,
  "emailAddress": "your-email@gmail.com"
}
```

**Visual Check**: JSON shows all true? ✅

---

#### ☐ Test 2: Ordini Automatici
```
1. Vai su: Fornitore Rekki-linked
2. Scroll to: "Ordini Rekki Automatici"
3. Click: "Controlla ora"
4. Wait: ~10 seconds
```

**Visual Check**: 
- Se email trovate → Lista ordini appare ✅
- Se nessuna email → "Nessun ordine ancora" ✅

---

#### ☐ Test 3: Cronologia Prezzi
```
1. Stessa pagina fornitore
2. Scroll to: "Cronologia Prezzi Storica"
3. Click: "Sincronizza Storico"
4. Conferma: "Sì"
5. Wait: ~2 minutes
```

**Visual Check**: 
- Tabs appaiono con dati? ✅
- Totale rimborso calcolato? ✅

---

## 🚨 Troubleshooting Visual

### Widget Giallo (Non Configurato)
```
┌─────────────────────────────────┐
│ ⚠️  Gmail API non configurato   │
│ Per attivare lo scanner...      │
│ [📖 Leggi le istruzioni setup]  │
└─────────────────────────────────┘
```

**Fix**: Aggiungi `GMAIL_CLIENT_ID` e `GMAIL_CLIENT_SECRET` a `.env.local`

---

### Widget Blu (Non Connesso)
```
┌─────────────────────────────────┐
│ 📧 Connetti il tuo account Gmail│
│ Autorizza l'app ad accedere...  │
│              [Connetti Gmail] →  │
└─────────────────────────────────┘
```

**Fix**: Click "Connetti Gmail" e segui OAuth flow

---

### Widget Verde (Tutto OK!)
```
┌─────────────────────────────────┐
│ ✅ Gmail connesso                │
│ Account: your@gmail.com          │
│ Scanner attivo ogni 15 min       │
│                  [Disconnetti]   │
└─────────────────────────────────┘
```

**Status**: Ready to use! 🎉

---

### Errore Google: "redirect_uri_mismatch"
```
┌─────────────────────────────────┐
│ Error 400: redirect_uri_mismatch│
│ The redirect URI...doesn't match│
└─────────────────────────────────┘
```

**Fix**:
1. Google Cloud Console → Credenziali
2. Click OAuth Client ID
3. Verifica URI:
   - `http://localhost:3000/api/auth/google/callback` ✅
4. Salva e attendi 5 minuti

---

### Errore Google: "App non verificata"
```
┌─────────────────────────────────┐
│ ⚠️  Questa app non è verificata  │
│ Google non ha verificato...      │
│     [Avanzate] [Annulla]         │
└─────────────────────────────────┘
```

**Fix**:
1. Click "Avanzate"
2. Click "Vai a Invoice Rekki Scanner (non sicuro)"
3. Questo è normale per app in sviluppo ✅

---

## 📊 Verifica Finale Completa

Usa questa checklist prima di considerare setup completo:

### Google Cloud Console
- [ ] Progetto creato
- [ ] Gmail API abilitata (badge verde)
- [ ] OAuth consent screen configurato
- [ ] 3 scopes aggiunti
- [ ] Utente test aggiunto (tua email)
- [ ] OAuth Client ID creato
- [ ] 2 URI redirect configurati
- [ ] Credenziali copiate

### File .env.local
- [ ] `GMAIL_CLIENT_ID` presente
- [ ] `GMAIL_CLIENT_SECRET` presente
- [ ] `NEXT_PUBLIC_SITE_URL` presente
- [ ] File salvato
- [ ] Dev server riavviato

### App UI
- [ ] Widget Gmail presente in Impostazioni
- [ ] Widget VERDE con email address
- [ ] "Connetti Gmail" button worked
- [ ] Redirect to Google worked
- [ ] Redirect back to app worked

### Funzionalità
- [ ] `/api/auth/google/status` returns connected: true
- [ ] "Controlla ora" in Ordini Automatici funziona
- [ ] "Sincronizza Storico" in Cronologia funziona
- [ ] CSV export funziona

---

## 🎉 Success Indicators

Quando tutto è configurato correttamente, vedrai:

**1. Settings Page**
```
╔════════════════════════════════════╗
║ ✅ Gmail connesso                  ║
║ Account: osteria@basilico.com      ║
║ Scanner attivo ogni 15 min         ║
╚════════════════════════════════════╝
```

**2. Supplier Page (Rekki)**
```
╔════════════════════════════════════╗
║ Ordini Rekki Automatici            ║
║ ┌────────────────────────────────┐ ║
║ │ Order Confirmation #12345       │ ║
║ │ 2 hours ago • 5 products        │ ║
║ │ 3 updated • 2 new               │ ║
║ └────────────────────────────────┘ ║
╚════════════════════════════════════╝
```

**3. Price History**
```
╔════════════════════════════════════╗
║ Cronologia Prezzi Storica          ║
║ [Sincronizza Storico] → Results:   ║
║                                     ║
║ 📧 45 emails  📦 120 products      ║
║ 💰 Potential Refund: £145.50       ║
╚════════════════════════════════════╝
```

---

## 📞 Need Help?

**Full Guide**: `INSTRUCTIONS_GOOGLE_API.md` (text version)

**Quick Debug**:
```bash
# Check env vars loaded
node -e "require('dotenv').config({path:'.env.local'}); console.log('ID:', process.env.GMAIL_CLIENT_ID?.slice(0,20)+'...', '\nSecret:', process.env.GMAIL_CLIENT_SECRET?.slice(0,15)+'...')"

# Check API status
curl http://localhost:3000/api/auth/google/status | jq

# Check database
npx supabase db push  # Run migrations
```

---

**Last Updated**: 2026-04-17  
**Version**: 1.0.0

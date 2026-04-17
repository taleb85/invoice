# 📧 Gmail API Setup - Istruzioni Complete

## Panoramica

Questa guida ti accompagna passo-passo nella configurazione dell'integrazione Gmail API per attivare lo scanner automatico email Rekki.

**Tempo richiesto**: ~10 minuti  
**Costo**: Gratuito (Gmail API free tier)  
**Prerequisiti**: Account Google (Gmail)

---

## PARTE 1: Google Cloud Console Setup

### Step 1: Crea un Progetto Google Cloud

1. Vai su **[Google Cloud Console](https://console.cloud.google.com/)**

2. Click sul menu a tendina del progetto (in alto a sinistra)

3. Click su **"Nuovo Progetto"**

4. Compila:
   - **Nome progetto**: `Invoice Rekki App` (o nome a tua scelta)
   - **Organizzazione**: Lascia vuoto (o seleziona se ne hai una)

5. Click **"Crea"**

6. Attendi 10-20 secondi per la creazione

7. Seleziona il progetto appena creato dal menu a tendina

---

### Step 2: Abilita Gmail API

1. Nel menu laterale, vai su **"API e servizi"** → **"Libreria"**

2. Nella barra di ricerca, digita: `Gmail API`

3. Click sul risultato **"Gmail API"**

4. Click sul pulsante blu **"Abilita"**

5. Attendi che l'API venga abilitata (~5 secondi)

---

### Step 3: Configura Schermata Consenso OAuth

Questa schermata apparirà agli utenti quando autorizzano l'app.

1. Nel menu laterale, vai su **"API e servizi"** → **"Schermata consenso OAuth"**

2. Seleziona **"Esterno"** (a meno che tu non abbia un Google Workspace)

3. Click **"Crea"**

4. **Pagina 1 - Informazioni app**:
   - **Nome app**: `Invoice Rekki Scanner`
   - **Email assistenza utenti**: Il tuo indirizzo email Gmail
   - **Logo app**: Opzionale (puoi saltare)
   - **Domini applicazione**: Lascia vuoto per ora
   - **Email sviluppatore**: Il tuo indirizzo email Gmail

5. Click **"Salva e continua"**

6. **Pagina 2 - Ambiti (Scopes)**:
   - Click **"Aggiungi o rimuovi ambiti"**
   - Cerca e seleziona questi 3 ambiti:
     - ✅ `https://www.googleapis.com/auth/gmail.readonly`
     - ✅ `https://www.googleapis.com/auth/gmail.modify`
     - ✅ `https://www.googleapis.com/auth/gmail.labels`
   - Click **"Aggiorna"**
   - Click **"Salva e continua"**

7. **Pagina 3 - Utenti di test**:
   - Click **"Aggiungi utenti"**
   - Inserisci il tuo indirizzo Gmail (quello dell'Osteria Basilico)
   - Click **"Aggiungi"**
   - Click **"Salva e continua"**

8. **Pagina 4 - Riepilogo**:
   - Verifica le informazioni
   - Click **"Torna alla dashboard"**

---

### Step 4: Crea Credenziali OAuth2

1. Nel menu laterale, vai su **"API e servizi"** → **"Credenziali"**

2. Click sul pulsante **"+ Crea credenziali"** in alto

3. Seleziona **"ID client OAuth"**

4. Configura:
   - **Tipo di applicazione**: `Applicazione web`
   - **Nome**: `Invoice Rekki Web Client`
   
5. **URI di reindirizzamento autorizzati**:
   - Click **"+ Aggiungi URI"**
   - **Sviluppo**: `http://localhost:3000/api/auth/google/callback`
   - Click **"+ Aggiungi URI"** di nuovo
   - **Produzione**: `https://your-domain.vercel.app/api/auth/google/callback`
     _(Sostituisci `your-domain` con il tuo dominio Vercel effettivo)_

6. Click **"Crea"**

7. **IMPORTANTE**: Apparirà un popup con le tue credenziali

   ```
   ID client: 123456789-abcdefg.apps.googleusercontent.com
   Segreto client: GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
   ```

8. **COPIA IMMEDIATAMENTE** questi valori! Li useremo nel prossimo step.

9. Click **"OK"** per chiudere il popup

---

## PARTE 2: Configurazione Locale (.env.local)

### Step 5: Aggiungi Credenziali al File .env.local

1. Apri il file `.env.local` nella root del progetto

2. Aggiungi queste righe (sostituendo con i tuoi valori copiati):

```bash
# ═══════════════════════════════════════════════════════════
# GMAIL API CONFIGURATION
# ═══════════════════════════════════════════════════════════

# Client ID from Google Cloud Console (Step 4.7)
GMAIL_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com

# Client Secret from Google Cloud Console (Step 4.7)
GMAIL_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ

# Site URL - Update after deploying to Vercel
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

3. **Salva il file**

4. **IMPORTANTE**: Non committare `.env.local` su Git! (è già in `.gitignore`)

---

## PARTE 3: Connetti Gmail Account nell'App

### Step 6: Autorizza Gmail nell'App

1. **Riavvia il dev server** per caricare le nuove variabili:
   ```bash
   # Ctrl+C per fermare, poi:
   npm run dev
   ```

2. Apri l'app nel browser: **http://localhost:3000**

3. Vai su **Settings** (o Dashboard)

4. Cerca il widget **"Connetti il tuo account Gmail"** (card blu)

5. Click sul pulsante **"Connetti Gmail"**

6. Verrai reindirizzato a Google:
   - Seleziona il tuo account Gmail (quello dell'Osteria Basilico)
   - Click **"Continua"** se appare un avviso "App non verificata"
   - Click **"Avanzate"** → **"Vai a Invoice Rekki Scanner (non sicuro)"**
   - Seleziona tutte e 3 le autorizzazioni:
     - ✅ Visualizzare i messaggi email
     - ✅ Gestire etichette email
     - ✅ Modificare email (solo mark as read)
   - Click **"Continua"**

7. Verrai reindirizzato all'app con messaggio di successo

8. Il widget diventerà **verde** con stato "Gmail connesso" ✅

---

## PARTE 4: Deploy Produzione (Vercel)

### Step 7: Aggiungi Variabili Ambiente su Vercel

1. Apri **[Vercel Dashboard](https://vercel.com/)**

2. Seleziona il tuo progetto Invoice

3. Vai su **"Settings"** → **"Environment Variables"**

4. Aggiungi le seguenti variabili (una per una):

   | Nome Variabile | Valore | Ambiente |
   |----------------|--------|----------|
   | `GMAIL_CLIENT_ID` | _(Il tuo Client ID)_ | Production, Preview, Development |
   | `GMAIL_CLIENT_SECRET` | _(Il tuo Client Secret)_ | Production, Preview, Development |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain.vercel.app` | Production |

   **Come aggiungere**:
   - Click **"Add New"**
   - Inserisci **Key** e **Value**
   - Seleziona tutti gli ambienti
   - Click **"Save"**

5. **AGGIORNA** l'URI di reindirizzamento su Google Cloud Console:
   - Torna su [Google Cloud Console](https://console.cloud.google.com/)
   - **API e servizi** → **Credenziali**
   - Click sul tuo **OAuth 2.0 Client ID**
   - In **"URI di reindirizzamento autorizzati"**, aggiungi:
     ```
     https://your-domain.vercel.app/api/auth/google/callback
     ```
     _(Sostituisci `your-domain` con il tuo dominio Vercel effettivo)_
   - Click **"Salva"**

---

### Step 8: Redeploy Vercel

1. Dopo aver aggiunto le variabili ambiente, redeploy:
   ```bash
   vercel --prod
   ```

2. Oppure fai un nuovo commit e push (se hai Vercel auto-deploy attivo):
   ```bash
   git add .
   git commit -m "Add Gmail API configuration"
   git push
   ```

3. Vercel rideploya automaticamente con le nuove variabili

---

## PARTE 5: Test & Verifica

### Step 9: Verifica che Tutto Funzioni

1. **Apri l'app in produzione**: `https://your-domain.vercel.app`

2. **Login** con il tuo account

3. Vai su **Settings**

4. Verifica widget Gmail:
   - ✅ **Verde** = Connesso e funzionante
   - 🟡 **Blu** = Configurato ma non connesso → Click "Connetti Gmail"
   - 🟠 **Ambra** = Non configurato → Vedi istruzioni sopra

5. **Test scanner automatico**:
   - Vai su un fornitore Rekki-linked
   - Scorri a **"Ordini Rekki Automatici"**
   - Click **"Controlla ora"**
   - Dovresti vedere le email processate

6. **Test cronologia prezzi**:
   - Nella stessa pagina, scorri a **"Cronologia Prezzi Storica"**
   - Click **"Sincronizza Storico"**
   - Attendi ~2 minuti
   - Verifica risultati (prezzi più bassi, rimborsi potenziali)

---

## 🎯 Riepilogo Valori da Configurare

### File `.env.local` (Sviluppo)

```bash
# From Step 4.7
GMAIL_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ

# Your local URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Vercel Environment Variables (Produzione)

| Variabile | Valore | Dove trovarlo |
|-----------|--------|---------------|
| `GMAIL_CLIENT_ID` | `123456789-abc...` | Google Cloud Console → Credenziali |
| `GMAIL_CLIENT_SECRET` | `GOCSPX-...` | Google Cloud Console → Credenziali |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.vercel.app` | Vercel Dashboard → Domains |

### Google Cloud Console - URI Reindirizzamento

```
Development:  http://localhost:3000/api/auth/google/callback
Production:   https://your-domain.vercel.app/api/auth/google/callback
```

---

## 🔧 Troubleshooting

### Problema: "Gmail API non configurato"

**Causa**: Variabili ambiente mancanti

**Soluzione**:
1. Verifica che `GMAIL_CLIENT_ID` e `GMAIL_CLIENT_SECRET` siano in `.env.local`
2. Riavvia dev server: `npm run dev`
3. Ricarica browser

---

### Problema: "Error 400: redirect_uri_mismatch"

**Causa**: URI di reindirizzamento non corrisponde

**Soluzione**:
1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. **API e servizi** → **Credenziali**
3. Click sul tuo OAuth Client ID
4. Verifica che gli URI includano:
   - `http://localhost:3000/api/auth/google/callback` (dev)
   - `https://your-domain.vercel.app/api/auth/google/callback` (prod)
5. Click **"Salva"**
6. Attendi 5 minuti per propagazione
7. Riprova

---

### Problema: "App non verificata" su Google

**Causa**: App in modalità test (normale per progetti personali)

**Soluzione**:
1. Click **"Avanzate"** nella schermata Google
2. Click **"Vai a Invoice Rekki Scanner (non sicuro)"**
3. Questo è normale per app in sviluppo/testing

**Per verificare l'app** (opzionale, non necessario):
1. Google Cloud Console → **Schermata consenso OAuth**
2. Click **"Pubblica app"**
3. Compila il modulo di verifica Google (richiede 1-2 settimane)

---

### Problema: "No refresh token received"

**Causa**: Hai già autorizzato questa app in passato

**Soluzione**:
1. Vai su **[myaccount.google.com/permissions](https://myaccount.google.com/permissions)**
2. Trova **"Invoice Rekki Scanner"** nella lista
3. Click → **"Rimuovi accesso"**
4. Torna nell'app e click **"Connetti Gmail"** di nuovo
5. Questa volta riceverai un nuovo refresh token

---

### Problema: "Quota exceeded" su Gmail API

**Causa**: Superato il limite giornaliero (raro)

**Limiti Gmail API**:
- **Free tier**: 1 miliardo di unità al giorno
- **Tipico uso**: ~1,000 unità/giorno

**Soluzione**:
1. Controlla quota su [Google Cloud Console](https://console.cloud.google.com/)
2. **API e servizi** → **Dashboard** → **Gmail API**
3. Se vicino al limite, attendi 24h per reset
4. Considera aumentare quota (richiesta a Google)

---

## 📊 Verifica Configurazione

### Checklist Setup Completo

Usa questa checklist per verificare ogni step:

- [ ] **Google Cloud Project creato**
- [ ] **Gmail API abilitata**
- [ ] **Schermata consenso OAuth configurata**
- [ ] **Ambiti (scopes) aggiunti**:
  - [ ] `gmail.readonly`
  - [ ] `gmail.modify`
  - [ ] `gmail.labels`
- [ ] **Utente di test aggiunto** (tua email Gmail)
- [ ] **OAuth 2.0 Client ID creato**
- [ ] **URI reindirizzamento configurati**:
  - [ ] `http://localhost:3000/api/auth/google/callback`
  - [ ] `https://your-domain.vercel.app/api/auth/google/callback`
- [ ] **Credenziali copiate**:
  - [ ] `GMAIL_CLIENT_ID`
  - [ ] `GMAIL_CLIENT_SECRET`
- [ ] **File `.env.local` aggiornato**
- [ ] **Dev server riavviato**
- [ ] **Gmail connesso nell'app** (widget verde)
- [ ] **Test "Controlla ora" funzionante**
- [ ] **Variabili aggiunte a Vercel** (se in produzione)
- [ ] **Deploy produzione effettuato**

---

## 🚀 Post-Setup: Come Usare

Una volta configurato, il sistema funziona automaticamente:

### 1. Scanner Automatico (Ogni 15 Minuti)

Il cron job `/api/cron/rekki-auto-poll` si attiva automaticamente:
- Cerca email non lette da `orders@rekki.com`
- Estrae prodotti e prezzi
- Aggiorna listino automaticamente
- Crea statement per triple-check

**Non devi fare nulla!** Il sistema lavora in background.

### 2. Ordini Automatici (UI)

Vai su **Fornitore** → Sezione "Ordini Rekki Automatici":
- Vedi lista ordini processati automaticamente
- Click per espandere dettagli
- Verifica price changes (old → new)

### 3. Cronologia Prezzi (On-Demand)

Quando vuoi analizzare lo storico:
1. Vai su **Fornitore** → Sezione "Cronologia Prezzi Storica"
2. Click **"Sincronizza Storico"**
3. Attendi ~2 minuti
4. Review risultati:
   - **Riepilogo**: Stats totali
   - **Prezzi Più Bassi**: Opportunità negoziazione
   - **Rimborsi Potenziali**: Overcharges da recuperare

### 4. Export & Richiesta Rimborso

Quando trovi discrepanze:
1. Tab **"Rimborsi Potenziali"**
2. Click **"Esporta CSV"**
3. Email CSV al fornitore
4. Richiedi nota di credito

---

## 🔒 Sicurezza & Privacy

### Dati Salvati
- **Token OAuth**: Salvati in `user_settings` table (Supabase)
- **Email content**: NON salvato (solo metadata)
- **Prezzi estratti**: Salvati in `rekki_price_history`

### Permessi Gmail
L'app può solo:
- ✅ Leggere email
- ✅ Marcare email come lette
- ✅ Aggiungere/modificare label
- ❌ NON può inviare email
- ❌ NON può eliminare email
- ❌ NON può accedere a Google Drive o altri servizi

### Revoca Accesso
Puoi revocare l'accesso in qualsiasi momento:
- **Nell'app**: Settings → Widget Gmail → "Disconnetti"
- **Su Google**: [myaccount.google.com/permissions](https://myaccount.google.com/permissions) → Rimuovi app

---

## 💡 Best Practices

### 1. Usa un Account Gmail Dedicato
- Crea `invoices@osteria-basilico.com` (Google Workspace)
- Usa solo per fatture/ordini Rekki
- Più facile da gestire e auditare

### 2. Organizza con Gmail Labels
Il sistema applica automaticamente:
- `Rekki/Processed` - Email già processate
- Puoi aggiungere filtri Gmail per organizzare meglio

### 3. Monitora Quota API
- Controlla usage su Google Cloud Console
- Alert se vicino al limite
- Tipicamente ben sotto il free tier

### 4. Backup Tokens
- I tokens sono salvati in Supabase (backup automatico)
- Se persi, puoi riautorizzare in 1 minuto
- Non serve manual backup

---

## 📞 Supporto

### Documentazione Correlata
- **Quick Start**: `README_REKKI_AUTOPILOT.md`
- **Technical Docs**: `docs/REKKI_AUTOPILOT.md`
- **Price History**: `docs/REKKI_PRICE_HISTORY_RECOVERY.md`

### Link Utili
- **Google Cloud Console**: https://console.cloud.google.com/
- **Gmail API Docs**: https://developers.google.com/gmail/api
- **OAuth2 Guide**: https://developers.google.com/identity/protocols/oauth2
- **Vercel Environment Vars**: https://vercel.com/docs/environment-variables

### Errori Comuni
Vedi sezione "Troubleshooting" sopra per soluzioni rapide.

---

## ✅ Completamento

Se hai completato tutti gli step della checklist, sei pronto! 🎉

**Test finale**:
```bash
# In un nuovo terminal
curl http://localhost:3000/api/auth/google/status

# Response atteso:
{
  "configured": true,
  "connected": true,
  "emailAddress": "your-email@gmail.com"
}
```

Se vedi questo, **il setup è completo!**

Lo scanner Rekki automatico è ora attivo e funzionante. 🚀

---

**Creato**: 2026-04-17  
**Versione**: 1.0.0  
**Autore**: Invoice Rekki Team

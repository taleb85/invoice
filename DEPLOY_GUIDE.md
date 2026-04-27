# FLUXO — Guida al Deploy su Vercel

Questa guida descrive i passaggi per portare **FLUXO** in produzione su Vercel in meno di 10 minuti.

> **Supabase SQL Editor — errore `syntax error at or near "#"`**  
> Stai incollando un file **Markdown** (`.md`), non SQL. I titoli con `#` non sono validi in PostgreSQL.  
> **Non incollare `DEPLOY_GUIDE.md` nell’editor.** Apri i file **`*.sql`** elencati al **Passo 3** più sotto e incolla **solo il contenuto SQL** di ciascuno, uno alla volta.  
> Opzionale: `supabase/sql-editor-reminder.sql` (commenti + `SELECT 1`) — incollalo per verificare l’editor senza modificare dati.

---

## Prerequisiti

| Requisito | Dove ottenerlo |
|---|---|
| Account Vercel | [vercel.com](https://vercel.com) |
| Progetto Supabase attivo | [supabase.com](https://supabase.com) |
| Chiave Google AI / Gemini (OCR) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Chiave Resend (email) | [resend.com](https://resend.com) |
| Node.js ≥ 18 installato | [nodejs.org](https://nodejs.org) |
| Vercel CLI installata | `npm i -g vercel` |

---

## Passo 1 — Connettere il Repository a Vercel

```bash
# Dalla cartella del progetto:
vercel link
```

Segui le istruzioni interattive:
- Seleziona o crea un progetto Vercel
- Framework: **Next.js** (rilevato automaticamente)
- Root directory: `.` (cartella corrente)

---

## Passo 2 — Configurare le Variabili d'Ambiente

Imposta le variabili nel pannello **Vercel → Progetto → Settings → Environment Variables** oppure tramite CLI:

```bash
# Supabase
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Google AI — Gemini (OCR fatture)
vercel env add GEMINI_API_KEY

# Resend (invio solleciti)
vercel env add RESEND_API_KEY

# Cron job protection
vercel env add CRON_SECRET

# IMAP globale (opzionale — solo se non configuri IMAP per ogni sede nel DB)
vercel env add IMAP_HOST
vercel env add IMAP_PORT
vercel env add IMAP_USER
vercel env add IMAP_PASSWORD

# Opzionale — gate PIN sulla schermata «Accesso amministratore» (/login), prima di email/password
# vercel env add ADMIN_LOGIN_GATE_PIN
```

> **Dove trovare i valori:**
> - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Dashboard → Settings → API → Project URL + anon key
> - `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard → Settings → API → service_role key ⚠️ (non esporre lato client)
> - `CRON_SECRET`: genera con `openssl rand -hex 32`
> - `ADMIN_LOGIN_GATE_PIN` *(opzionale)*: stringa da 1 a 12 caratteri (anche alfanumerica). Se impostata, il login admin richiede prima questo codice; se assente, il comportamento resta senza gate.

---

## Passo 3 — Configurare il Database Supabase

Esegui gli script SQL nell'ordine sotto dalla **Supabase Dashboard → SQL Editor**.  
Salta i file già applicati sul tuo progetto (la maggior parte usa `IF NOT EXISTS` / `DROP IF EXISTS` ed è idempotente).

**Come fare:** in Cursor o nel file system apri ad es. `multi-sede.sql`, seleziona tutto il testo SQL, copia, incolla in Supabase → **Run**. Ripeti per ogni file nell’ordine.  
Non usare questo file `.md` come query: servono i file `.sql` del progetto. Checklist in commenti SQL: `supabase/sql-editor-reminder.sql`.

### Fase A — Base (progetti nuovi o storici senza multi-sede)

```
1.  multi-sede.sql                  — Sedi, profili, fornitori, bolle, fatture, RLS base
2.  create-log-table.sql            — log_sincronizzazione
3.  security-and-performance.sql   — documenti_da_processare, RLS, indici
4.  setup-storage.sql              — Bucket "documenti" + policy iniziali (eseguire prima di security-update)
5.  security-update.sql            — Restringe policy storage a utenti autenticati
```

### Fase B — Estensioni documentate in repo root

```
6.  add-country-code.sql
7.  add-da-associare-stato.sql
8.  fix-documenti-visibilita.sql
9.  fix-rls-null-sede.sql
10. add-importo-multibolla.sql     — importo bolle, junction fattura_bolle
11. add-fornitore-emails.sql
12. add-fornitore-display-name.sql — display_name fornitori
13. add-ai-metadata.sql
14. add-statement-column.sql       — is_statement su documenti_da_processare
15. add-registrato-da.sql
16. sedi-imap.sql                  — colonne IMAP su sedi
```

### Fase C — Cartella `migrations/`

```
17. migrations/listino_prezzi.sql
18. migrations/fornitore_contatti.sql
19. migrations/add-imap-lookback-days.sql
```

### Fase D — Cartella `supabase/migrations/` (statement + Rekki + localizzazione sede)

```
20. supabase/migrations/add-statements.sql              — statements / statement_rows
21. supabase/migrations/add-rekki-statement-status.sql  — check_status Rekki + RPC bolla_has_rekki_prezzo_flag
22. supabase/migrations/add-sede-currency-timezone-lang.sql
23. supabase/migrations/add-fornitore-display-name.sql  — solo se non hai già eseguito (12); altrimenti salta
```

> **Nota:** `add-fornitore-display-name.sql` è duplicato tra root e `supabase/migrations/` — esegui **una sola volta**.

---

## Passo 4 — Configurare il Cron Job

Il file `vercel.json` configura già la scansione email automatica:

```json
{
  "crons": [
    {
      "path": "/api/scan-emails",
      "schedule": "0 8 * * *"
    }
  ]
}
```

La scansione avviene ogni giorno alle **08:00 UTC**. Modifica `schedule` se necessario (formato cron standard).

> **Requisito**: Il cron job richiede il piano **Vercel Pro** (o superiore).  
> In alternativa, puoi usare un cron esterno (es. cron-job.org) che chiama `POST /api/scan-emails` con header `Authorization: Bearer {CRON_SECRET}`.

---

## Passo 5 — Deploy in Produzione

```bash
npm run deploy
```

Equivale a `npm run build` seguito da `npx vercel --prod --yes` (richiede login Vercel / progetto già collegato). In alternativa: `vercel --prod`.

Per un controllo rigoroso prima del deploy (include ESLint — il repo può avere warning/errori da sistemare): `npm run verify`.

Al termine, Vercel mostrerà l'URL di produzione (es. `https://invoice-psi-six.vercel.app`).

---

## Passo 6 — Verifica Post-Deploy

Dopo il deploy, controlla i seguenti punti:

- [ ] **Login**: Accedi con le credenziali admin su `/login`
- [ ] **Dashboard**: Verifica che le bolle aperte vengano caricate
- [ ] **Sidebar**: Sfondo `#0f172a` (Deep Ocean) e logo con gradiente blu-ciano
- [ ] **Scansione email**: Triggera manualmente `POST /api/scan-emails` dalla Dashboard
- [ ] **Log**: Verifica `/log` per eventuali errori di elaborazione
- [ ] **Mobile**: Apri su smartphone — verifica l'hamburger menu e il layout responsive

---

## Variabili Opzionali

| Variabile | Descrizione |
|---|---|
| `IMAP_HOST` | Host IMAP casella centralizzata (es. `imap.gmail.com`) |
| `IMAP_PORT` | Porta IMAP (default: `993`) |
| `IMAP_USER` | Username/email IMAP |
| `IMAP_PASSWORD` | Password o App Password IMAP |

> Se ogni sede ha la propria casella IMAP configurata nel DB (tabella `sedi`), queste variabili globali non sono necessarie.

---

## Risoluzione Problemi

### Build fallisce
```bash
npm run build   # Verifica errori TypeScript in locale prima del deploy
```

### Pagine bianche in produzione
- Controlla Vercel → Functions → Logs per errori server-side
- Verifica che tutte le variabili d'ambiente siano impostate correttamente

### Scansione email non funziona
- Controlla che `SUPABASE_SERVICE_ROLE_KEY` sia impostata (necessaria per la scansione)
- Verifica le credenziali IMAP nella tabella `sedi` del database
- Controlla i log del cron job in Vercel → Settings → Cron Jobs

### Errore 401 su /api/me
- La sessione Supabase non è valida — effettua il logout e rientra

---

## Aggiornamenti Futuri

```bash
git add .
git commit -m "feat: descrizione della modifica"
npm run deploy
```

---

*FLUXO — Gestione Fatture · Versione 1.0*

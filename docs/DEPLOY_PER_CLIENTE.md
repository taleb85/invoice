# Deploy per cliente (base operativa)

**Stato:** preparazione. **Non avviare** nuovi ambienti finché non serve: questa pagina è la checklist quando avrai ogni cliente.

## Principio

- **Un cliente commerciale = un progetto Supabase + un progetto Vercel** (stesso codice sorgente, variabili d’ambiente diverse).
- **Mai** riutilizzare `NEXT_PUBLIC_SUPABASE_URL`, anon key o `SUPABASE_SERVICE_ROLE_KEY` tra clienti diversi.

Piano stack attuale confermato: **Supabase Free**, **Vercel Hobby**.

## Quando apri un nuovo cliente

1. **Supabase**
   - Crea un **nuovo progetto** (nuovo database) nella dashboard.
   - Applica le **migration** presenti in `supabase/migrations/` nell’ordine cronologico (SQL Editor o CLI).
   - Allinea eventuali script one-shot documentati in repo solo se necessari per quel rollout.
   - Crea il primo utente **Auth** e imposta il profilo **admin** (come già fatto per il primo cliente).
   - Configura **Storage** se richiesto dagli script del repo.

2. **Vercel**
   - Crea un **nuovo progetto** collegato allo stesso repository Git.
   - Imposta le **Environment Variables** copiando da `.env.example`: un set completo **per questo** cliente (Supabase di quel progetto + segreti condivisi solo se accettabile per contratto, es. `GEMINI_API_KEY` — valuta per cliente).
   - Esegui il deploy di produzione (o preview per test).

3. **Dominio (opzionale)**
   - Collega dominio/custom hostname nel progetto Vercel del cliente.
   - Imposta `NEXT_PUBLIC_SITE_URL` al dominio pubblico.

4. **Verifica isolamento**
   - Accedi all’app del cliente A: nessun dato del cliente B.
   - Controlla di non aver incollato per errore chiavi Supabase del progetto sbagliato sul deploy.

## Repository e rilasci

- **Un solo codice:** `main` (o branch di release) → tre deploy possono puntare allo stesso commit.
- Ogni correzione rilasciata: **ripeti deploy** (o attendi auto-deploy da Git) su **ogni** progetto Vercel che deve ricevere l’aggiornamento.

## Evoluzione futura (non avviata)

Unificare più clienti in **un solo database** con `organization_id` e RLS richiede migrazione dati e revisione massiva del codice: **fuori scope** finché resti su “un DB per cliente”.

## Riferimenti

- Variabili: `.env.example`
- Schema di partenza storico: `multi-sede.sql`, `supabase/schema.sql` + cartella `supabase/migrations/`

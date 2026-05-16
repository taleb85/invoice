# ANALISI COMPLETA DELL'ARCHITETTURA DEL SISTEMA DI GESTIONE DOCUMENTALE

## Report di Mappatura Schede, Controlli, Attori e Flussi di Navigazione

**Data analisi:** 2026-05-14
**Progetto:** Invoice Management System (Next.js + Supabase)
**Versione app:** NEXT_PUBLIC_APP_VERSION

---

## INDICE

1. [Sommario Esecutivo](#1-sommario-esecutivo)
2. [Classificazione delle Schede per Tipologia di Controllo](#2-classificazione-delle-schede-per-tipologia-di-controllo)
3. [Catalogo Completo delle Schede di Controllo](#3-catalogo-completo-delle-schede-di-controllo)
4. [Matrice di Tracciabilità Schede ⇔ Processi di Controllo](#4-matrice-di-tracciabilità-schede--processi-di-controllo)
5. [Identificazione Attori e Permessi](#5-identificazione-attori-e-permessi)
6. [Flussi di Navigazione tra le Schede](#6-flussi-di-navigazione-tra-le-schede)
7. [Stima del Carico di Lavoro per Utente/Tipo Documento](#7-stima-del-carico-di-lavoro-per-utentetipo-documento)
8. [API Endpoint di Controllo Documentale](#8-api-endpoint-di-controllo-documentale)
9. [Workflow Completi di Controllo](#9-workflow-completi-di-controllo)
10. [Lacune Identificate e Raccomandazioni](#10-lacune-identificate-e-raccomandazioni)
11. [Appendice: Database Schema Rilevante](#11-appendice-database-schema-rilevante)

---

## 1. SOMMARIO ESECUTIVO

Il sistema implementa un'architettura completa di gestione documentale con **5 macro-aree di controllo** distribuite su **34 schede (pagine/componenti)** distinte. L'infrastruttura copre l'intero ciclo di vita del documento: dall'acquisizione (email/IMAP/scan/upload) alla validazione OCR/AI, associazione fornitore, verifica incrociata (triple-check), approvazione formale, archiviazione e audit logging.

### Conteggi Principali

| Metrica | Valore |
|---|---|
| Schede/interfacce di controllo identificate | **34** |
| Tipologie di controllo distinte | **5** (Validazione, Verifica, Approvazione, Revisione, Audit) |
| API endpoint di controllo documentale | **30+** |
| Ruoli utente coinvolti | **3** (admin, admin_sede, operatore) |
| Stati workflow documentali | **15+** |
| Tabelle database di controllo | **28** |
| Componenti React dedicati al controllo | **20+** |
| Attori del sistema | **3 categorie + sistema/AI** |

---

## 2. CLASSIFICAZIONE DELLE SCHEDE PER TIPOLOGIA DI CONTROLLO

Il sistema implementa 5 tipologie di controllo, organizzate gerarchicamente lungo il ciclo di vita del documento:

### 2.1 Tassonomia dei Controlli

```
                    ┌──────────────────────────────┐
                    │     VALIDAZIONE (V)           │
                    │  Riconoscimento/Acquisizione  │
                    │  OCR, AI Classify, Scarto     │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │     VERIFICA (Vf)             │
                    │  Associazione fornitore       │
                    │  Triple-check, Riconciliaz.   │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │     APPROVAZIONE (A)          │
                    │  Approvazione/Rifiuto fatture │
                    │  AI Check, Approvaz. bulk     │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │     REVISIONE (R)             │
                    │  Analisi prezzi, Duplicati    │
                    │  Qualità dati, Correzioni     │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │     AUDIT (Au)                │
                    │  Activity Log, Attività       │
                    │  Verifica documentale         │
                    └──────────────────────────────┘
```

### 2.2 Distribuzione per Tipologia

| Tipologia | Codice | N. Schede | % |
|---|---|---|---|
| Validazione (OCR/AI/Acquisizione) | V | 8 | 23.5% |
| Verifica (Associazione/Riconciliazione) | Vf | 7 | 20.6% |
| Approvazione | A | 3 | 8.8% |
| Revisione (Analisi/Correzione) | R | 9 | 26.5% |
| Audit (Log/Monitoraggio) | Au | 4 | 11.8% |
| Multi-tipologia (Dashboard/KPI) | M | 3 | 8.8% |
| **TOTALE** | | **34** | **100%** |

---

## 3. CATALOGO COMPLETO DELLE SCHEDE DI CONTROLLO

### 3.1 Schede di Validazione (V) — Riconoscimento e Acquisizione Documenti

| # | Scheda | Percorso | Tipo Controllo | Descrizione | Azioni Chiave |
|---|---|---|---|---|---|
| V1 | **AI Inbox — Documenti** | `/inbox-ai?tab=docs` | Validazione AI/OCR | Coda principale documenti in arrivo. Classificazione AI del tipo documento, estrazione dati, suggerimento fornitore | Analisi AI batch (5 doc), conferma suggerimenti, finalizzazione tipo (fattura/bolla/listino), scarto, blacklist mittente |
| V2 | **AI Inbox — Audit abbinamenti** | `/inbox-ai?tab=audit` | Validazione post-associazione | Documenti già associati ma con email mittente non corrispondente alle email note del fornitore | Riassegnazione fornitore, aggiunta email a fornitore |
| V3 | **AI Inbox — Duplicati fatture** | `/inbox-ai?tab=fatture` | Validazione deduplicazione | Gruppi di fatture duplicate rilevate dall'AI | "Tieni questa / elimina le altre", dettaglio documento |
| V4 | **AI Inbox — Duplicati bolle** | `/inbox-ai?tab=bolle` | Validazione deduplicazione | Gruppi di bolle duplicate rilevate dall'AI | "Tieni questa / elimina le altre", dettaglio documento |
| V5 | **Coda Documenti (Dashboard)** | `/` (sezione Dashboard) | Validazione coda | Coda documenti generica con raggruppamento per fornitore | Scarta, nuovo fornitore, apri documento, link a statements |
| V6 | **Scanner rapido** | Componente `QuickScanModal` | Acquisizione rapida | Scan/Foto rapida documento da mobile | Upload/scan, OCR immediato, salvataggio |
| V7 | **Blacklist Email** | Componente `EmailBlacklistPanel` | Validazione filtri | Gestione mittenti bloccati (non ricevere più documenti da certi mittenti) | Aggiungi/rimuovi blacklist, motivo blocco |
| V8 | **Regole Scarto OCR** | Componente `OcrScartoRulesPanel` | Validazione automatica | Regole automatiche di scarto basate su pattern (exact/regex/contains) nel testo OCR | Crea/modifica/elimina regole, pattern matching |

### 3.2 Schede di Verifica (Vf) — Associazione e Riconciliazione

| # | Scheda | Percorso | Tipo Controllo | Descrizione | Azioni Chiave |
|---|---|---|---|---|---|
| Vf1 | **Statements — Da Processare** | `/statements/da-processare` | Verifica associazione | Coda estratti conto in attesa di elaborazione/associazione fornitore | Associa fornitore, apri PDF, ri-analisi OCR, converti in fattura, finalizza tipo documento |
| Vf2 | **Statements — Verifica (Triple-Check)** | `/statements/verifica` | Verifica incrociata | Triple-check: confronto estratto conto vs fatture sistema vs bolle. 6 stati di verifica | Filtra per esito check, invia sollecito, sposta in fatture, ri-analisi |
| Vf3 | **Statements — Vista principale** | `/statements` | Verifica multi-vista | Vista a tab tra "Da processare" e "Verifica" con navigazione | Alterna tab, vista fornitore-specifica |
| Vf4 | **Dettaglio Fornitore — Tab Verifica** | `/fornitori/[id]?tab=verifica` | Verifica mensile per fornitore | Tabella confronto mensile per mese fiscale. Verifica completezza documenti per fornitore | Navigazione anno/mese, verifica per fornitore |
| Vf5 | **Dettaglio Fornitore — Tab Documenti** | `/fornitori/[id]?tab=documenti` | Verifica coda fornitore | Documenti in coda di elaborazione per il fornitore specifico | Visualizzazione coda contestuale |
| Vf6 | **Bolle — Dettaglio** | `/bolle/[id]` | Verifica bolla | Dettaglio bolla con toggle stato, analisi AI, listino prezzi Rekki, fatture collegate | Cambio stato (completato/in attesa), analisi AI, collegamento fattura, verifica prezzo Rekki |
| Vf7 | **Bolle — Lista** | `/bolle` | Verifica elenco | Lista bolle con filtri vista (oggi/tutte/in attesa), deduplicazione automatica | Toggle vista, export CSV, deduplicazione automatica |

### 3.3 Schede di Approvazione (A)

| # | Scheda | Percorso | Tipo Controllo | Descrizione | Azioni Chiave |
|---|---|---|---|---|---|
| A1 | **Approvazioni Fatture** | `/approvazioni` | Approvazione formale | Coda fatture in attesa di approvazione/rifiuto. Supporta verifica AI e bulk | Approva singola, rifiuta con motivo, check & approve AI, approva tutte con AI bulk |
| A2 | **Impostazioni Approvazione** | `/sedi/[id]/approval-settings` | Configurazione approvazione | Impostazioni soglia approvazione, auto-registrazione, require_approval | Toggle require_approval, soglia importo, auto_register toggle |
| A3 | **Badge Approvazione** | Componente `ApprovalBadge` | Indicatore stato | Badge stato approvazione embedded in liste fatture (pending/approved/rejected) | Visualizzazione stato, popup motivo rifiuto |

### 3.4 Schede di Revisione (R) — Analisi e Correzione

| # | Scheda | Percorso | Tipo Controllo | Descrizione | Azioni Chiave |
|---|---|---|---|---|---|
| R1 | **Centro Operazioni** | `/strumenti/centro-operazioni` | Revisione operativa | Pannello centralizzato per operazioni batch: cleanup, sync email, qualità OCR, duplicati | Forza cleanup, sync email manuale/storico, fix OCR, reclassify pending kind, gestione duplicati |
| R2 | **Analisi Prezzi** | `/strumenti/analisi-prezzi` | Revisione analitica | Dashboard price intelligence: salute prezzi fornitori con score e trend | Score salute, indicatori trend (aumento/diminuzione), navigazione listino fornitore |
| R3 | **Verifica Documenti** | `/strumenti/verifica-documenti` | Revisione correttiva | Panoramica stato elaborazione: documenti bloccati, errori sync, statement con problemi | Scarta/blocca, riprocessa singolo/bulk, riprocessa log errori |
| R4 | **Verifica Associazioni** | `/strumenti/verifica-associazioni` | Revisione ispettiva con ML | Catalogo qualità associazioni con sistema di apprendimento (pattern mining) | Filtri avanzati, azioni bulk (scarta/resetta/cambia categoria), pattern learning, export JSON |
| R5 | **Revisione Documenti (Hub)** | `/revisione` | Revisione riepilogativa | Hub di navigazione centralizzato con KPI numerici per ogni coda | Navigazione a code specifiche, selezione anno fiscale |
| R6 | **Listino Prezzi** | `/listino` | Revisione prezzi | Gestione listini prezzi fornitori, sincronizzazione Rekki | Importa da fattura/Rekki, sync storico, price intelligence |
| R7 | **Analisi AI** | Componente `AiAnalysisModal` | Revisione AI | Analisi approfondita AI su singolo documento | Analisi con Gemini, visualizzazione risultati |
| R8 | **Duplicati — Gestione** | Componente `DuplicateManager` | Revisione deduplicazione | Scansione e risoluzione duplicati in tutte le entità | Scansione completa, risoluzione gruppi |
| R9 | **Aggiornamento Categoria** | Componente `CategoriaDropdown` | Revisione classificazione | Cambio categoria documento (fiscale/non_fiscale) su selezione multipla | Dropdown categoria, azione bulk |

### 3.5 Schede di Audit (Au)

| # | Scheda | Percorso | Tipo Controllo | Descrizione | Azioni Chiave |
|---|---|---|---|---|---|
| Au1 | **Attività (Activity Log)** | `/attivita` | Audit cronologico | Timeline cronologica completa di tutte le operazioni del sistema | Filtri per operatore/periodo/categoria, export CSV, scroll infinito |
| Au2 | **Dettaglio Fornitore — Tab Audit** | `/fornitori/[id]?tab=audit` | Audit per fornitore | Log operazioni specifiche per fornitore | Visualizzazione cronologica filtrata |
| Au3 | **Dashboard Analytics** | `/analytics` | Audit KPI | Panoramica acquisti e riconciliazione con KPI | Metriche, tempi medi, percentuali |
| Au4 | **Consumi AI** | `/consumi-ai` | Audit AI | Monitoraggio utilizzo API Gemini: token, costi, durata | Report consumi, statistiche |

### 3.6 Schede Multi-tipologia / Dashboard (M)

| # | Scheda | Percorso | Tipo Controllo | Descrizione | Azioni Chiave |
|---|---|---|---|---|---|
| M1 | **Dashboard Home** | `/` | Multi-controllo | KPI riepilogativi, bolle recenti, banner duplicati, suggerimenti fornitori | KPI numerici, navigazione rapida, contesto ruoli |
| M2 | **Dettaglio Fornitore** | `/fornitori/[id]` | Multi-controllo | Hub fornitore con 8 tab: Dashboard, Ordini, Bolle, Fatture, Verifica, Listino, Documenti, Audit | KPI per area, navigazione tab, anno fiscale |
| M3 | **Dettaglio Fattura** | `/fatture/[id]` | Consultazione | Dettaglio informativo fattura: fornitore, data, importo, bolla collegata | Apri allegato, analisi AI, sostituisci file |

---

## 4. MATRICE DI TRACCIABILITÀ SCHEDE ⇔ PROCESSI DI CONTROLLO

### 4.1 Processi di Controllo Documentale

| ID | Processo | Descrizione | Tabelle coinvolte |
|---|---|---|---|
| P1 | Acquisizione documento | Ricezione da email/scan/upload, OCR, classificazione AI | `documenti_da_processare`, `sedi_imap_sync_log` |
| P2 | Associazione fornitore | Matching documento ↔ fornitore (manuale/AI/suggerimento) | `documenti_da_processare`, `fornitori`, `fornitore_emails` |
| P3 | Classificazione tipo | Determinazione tipo documento (fattura/bolla/ordine/statement) | `documenti_da_processare` (metadata.tipo_documento) |
| P4 | Validazione deduplicazione | Rilevamento e risoluzione duplicati | `fatture`, `bolle`, `conferme_ordine` |
| P5 | Registrazione documento | Creazione entità contabile (fattura/bolla/ordine) | `fatture`, `bolle`, `conferme_ordine` |
| P6 | Triple-check / Riconciliazione | Confronto estratto conto vs fatture vs bolle | `statement_rows`, `fatture`, `bolle` |
| P7 | Verifica prezzi | Controllo prezzi fattura/bolla vs listino Rekki | `listino_prezzi`, `rekki_price_history` |
| P8 | Approvazione fattura | Approvazione/rifiuto formale con/senza AI check | `fatture` (approval_status, approved_by) |
| P9 | Configurazione controlli | Impostazione soglie e policy di controllo | `configurazioni_app`, `sedi` (approval-settings) |
| P10 | Audit e monitoraggio | Tracciamento operazioni, log attività, KPI | `attivita`, `ai_usage_log`, `log_sincronizzazione` |
| P11 | Gestione anomalie | Identificazione e risoluzione discrepanze | `statement_rows` (check_status), `bolle` (rekki_prezzo_flag) |
| P12 | Correzione massiva | Operazioni bulk su documenti (scarta, resetta, riclassifica) | `documenti_da_processare`, `documenti-associati` |

### 4.2 Matrice Schede × Processi

```
         │ P1  P2  P3  P4  P5  P6  P7  P8  P9  P10 P11 P12
─────────┼─────────────────────────────────────────────────────
   V1    │  ●   ●   ●   ●   ●   ─   ─   ─   ─   ─   ─   ─
   V2    │  ─   ●   ─   ─   ─   ─   ─   ─   ─   ─   ─   ─
   V3    │  ─   ─   ─   ●   ─   ─   ─   ─   ─   ─   ─   ─
   V4    │  ─   ─   ─   ●   ─   ─   ─   ─   ─   ─   ─   ─
   V5    │  ─   ●   ─   ─   ─   ─   ─   ─   ─   ─   ─   ─
   V6    │  ●   ─   ─   ─   ─   ─   ─   ─   ─   ─   ─   ─
   V7    │  ●   ─   ─   ─   ─   ─   ─   ─   ─   ─   ─   ─
   V8    │  ●   ─   ─   ─   ─   ─   ─   ─   ─   ─   ─   ─
─────────┼─────────────────────────────────────────────────────
   Vf1   │  ─   ●   ●   ─   ●   ●   ─   ─   ─   ─   ─   ─
   Vf2   │  ─   ─   ─   ─   ─   ●   ●   ─   ─   ─   ●   ─
   Vf3   │  ─   ●   ─   ─   ─   ●   ─   ─   ─   ─   ●   ─
   Vf4   │  ─   ─   ─   ─   ─   ●   ─   ─   ─   ─   ●   ─
   Vf5   │  ─   ●   ─   ─   ─   ─   ─   ─   ─   ─   ─   ─
   Vf6   │  ─   ─   ─   ─   ●   ─   ●   ─   ─   ─   ●   ─
   Vf7   │  ─   ─   ─   ●   ●   ─   ─   ─   ─   ─   ─   ─
─────────┼─────────────────────────────────────────────────────
   A1    │  ─   ─   ─   ─   ─   ─   ─   ●   ─   ─   ─   ─
   A2    │  ─   ─   ─   ─   ─   ─   ─   ─   ●   ─   ─   ─
   A3    │  ─   ─   ─   ─   ─   ─   ─   ●   ─   ─   ─   ─
─────────┼─────────────────────────────────────────────────────
   R1    │  ─   ─   ●   ●   ─   ─   ─   ─   ─   ─   ─   ●
   R2    │  ─   ─   ─   ─   ─   ─   ●   ─   ─   ─   ●   ─
   R3    │  ─   ─   ─   ─   ─   ─   ─   ─   ─   ●   ●   ●
   R4    │  ─   ●   ●   ─   ─   ─   ─   ─   ─   ─   ●   ●
   R5    │  ─   ─   ─   ─   ─   ─   ─   ─   ─   ─   ─   ─
   R6    │  ─   ─   ─   ─   ─   ─   ●   ─   ─   ─   ●   ─
   R7    │  ●   ●   ●   ─   ─   ─   ─   ─   ─   ─   ─   ─
   R8    │  ─   ─   ─   ●   ─   ─   ─   ─   ─   ─   ─   ●
   R9    │  ─   ─   ●   ─   ─   ─   ─   ─   ─   ─   ─   ●
─────────┼─────────────────────────────────────────────────────
   Au1   │  ─   ─   ─   ─   ─   ─   ─   ─   ─   ●   ─   ─
   Au2   │  ─   ─   ─   ─   ─   ─   ─   ─   ─   ●   ─   ─
   Au3   │  ─   ─   ─   ─   ─   ●   ─   ─   ─   ●   ─   ─
   Au4   │  ─   ─   ─   ─   ─   ─   ─   ─   ─   ●   ─   ─
─────────┼─────────────────────────────────────────────────────
   M1    │  ●   ●   ─   ●   ─   ─   ─   ─   ─   ─   ─   ─
   M2    │  ─   ─   ─   ─   ─   ●   ●   ─   ─   ●   ●   ─
   M3    │  ─   ─   ─   ─   ─   ─   ─   ─   ─   ─   ─   ─
```

**Legenda:** ● = copertura diretta, ─ = non coperto

---

## 5. IDENTIFICAZIONE ATTORI E PERMESSI

### 5.1 Ruoli del Sistema

| Ruolo | Codice | Livello | Metodo Login | Sessione Max | Sessione Inattività | Permessi Controllo |
|---|---|---|---|---|---|---|
| **Admin Master** | `admin` | Globale (tutte le sedi) | Email + Password (Portale Gestionale) | 24h | 2h | Completi: approvazione, audit, configurazione, gestione utenti, tutte le sedi |
| **Admin Sede** | `admin_sede` | Per sede (`sede_id`) | Nome + PIN (Accesso Azienda) | 24h | 2h | Completi sulla propria sede: approvazione, audit, configurazione, gestione operatori |
| **Operatore** | `operatore` | Per sede (`sede_id`) | Nome + PIN (Accesso Azienda) | 8h | 30min | Operativi: validazione, verifica, revisione (NO approvazione, NO audit, NO configurazione) |

### 5.2 Matrice Attori × Schede

```
         │ Admin    Admin     Operatore
         │ Master    Sede
─────────┼─────────────────────────────────
   V1    │   ●        ●           ●
   V2    │   ●        ●           ●
   V3    │   ●        ●           ●
   V4    │   ●        ●           ●
   V5    │   ●        ●           ●
   V6    │   ●        ●           ●
   V7    │   ●        ●           ─
   V8    │   ●        ●           ─
─────────┼─────────────────────────────────
   Vf1   │   ●        ●           ●
   Vf2   │   ●        ●           ●
   Vf3   │   ●        ●           ●
   Vf4   │   ●        ●           ●
   Vf5   │   ●        ●           ●
   Vf6   │   ●        ●           ●
   Vf7   │   ●        ●           ●
─────────┼─────────────────────────────────
   A1    │   ●        ●           ─
   A2    │   ●        ●           ─
   A3    │   ●        ●           ─(*)
─────────┼─────────────────────────────────
   R1    │   ●        ●           ─
   R2    │   ●        ●           ●
   R3    │   ●        ●           ─
   R4    │   ●        ●           ─
   R5    │   ●        ●           ●
   R6    │   ●        ●           ●
   R7    │   ●        ●           ●
   R8    │   ●        ●           ●
   R9    │   ●        ●           ●
─────────┼─────────────────────────────────
   Au1   │   ●        ●           ─
   Au2   │   ●        ●           ●
   Au3   │   ●        ●           ●
   Au4   │   ●        ●           ●
─────────┼─────────────────────────────────
   M1    │   ●        ●           ●
   M2    │   ●        ●           ●
   M3    │   ●        ●           ●
```

**Legenda:** ● = accesso consentito, ─ = accesso negato
(*) Il badge di approvazione è visibile a tutti, ma le azioni di approvazione/rifiuto sono limitate.

### 5.3 API-level Authorization

Il middleware di autorizzazione API [api-auth.ts](file:///Users/talebbarikhan/Projects/invoice/src/lib/api-auth.ts) implementa 3 livelli:

| Livello | Funzione | Schede/API protette |
|---|---|---|
| `requireAuth()` | Solo autenticazione | Schede base (V1-V5, Vf1-Vf7, M1-M3) |
| `requireAdmin()` | `master_admin` o `sede_privileged` | Approvazioni (A1-A3), Centro Operazioni (R1), Verifica Doc (R3-R4), Attività (Au1) |
| `isMasterAdminRole()` | Solo master_admin | Impostazioni approvazione (A2), Configurazione sedi |

---

## 6. FLUSSI DI NAVIGAZIONE TRA LE SCHEDE

### 6.1 Mappa di Navigazione Principale

```
                    ┌─────────────────────┐
                    │   DASHBOARD HOME    │  ← Punto di ingresso principale
                    │    (/) [M1]         │
                    └────┬────┬────┬──────┘
                         │    │    │
              ┌──────────┘    │    └──────────┐
              ▼               ▼               ▼
   ┌──────────────────┐ ┌──────────┐ ┌──────────────┐
   │ Revisione Doc.   │ │ Inbox AI │ │ Statements   │
   │ (/revisione)[R5] │ │(/inbox-ai)││ (/statements)│
   └────────┬─────────┘ │   [V1-V4]│ │   [Vf1-Vf3]  │
            │           └──────────┘ └──────┬───────┘
            ▼                               │
   ┌──────────────────┐                     ├──► /da-processare [Vf1]
   │ AI Inbox (docs)  │◄────────────────────┘   └──► /verifica [Vf2]
   │ /inbox-ai?tab=   │
   │  docs/audit/     │     ┌─────────────────┐
   │  fatture/bolle/  │     │  Approvazioni   │
   │  rekki           │     │ (/approvazioni) │
   └──────────────────┘     │    [A1]         │
                            └─────────────────┘
   ┌──────────────────┐
   │ Attività (Log)   │     ┌─────────────────┐
   │ (/attivita) [Au1]│     │  Strumenti      │
   └──────────────────┘     │ (/strumenti)    │
                            │   [R1-R4,R6]    │
                            └───┬───┬───┬─────┘
                                │   │   │
              ┌─────────────────┘   │   └──────────────┐
              ▼                     ▼                  ▼
   ┌─────────────────┐  ┌─────────────────┐ ┌────────────────┐
   │ Centro Op.      │  │ Verifica Doc.   │ │ Analisi Prezzi │
   │ /strumenti/     │  │ /strumenti/     │ │ /strumenti/    │
   │ centro-op.[R1]  │  │ verifica-doc[R3]│ │ analisi-p[R2] │
   └─────────────────┘  └─────────────────┘ └────────────────┘
```

### 6.2 Flusso di Navigazione per Processo

#### Flusso Acquisizione → Validazione (P1 → P2 → P3)

```
Email/Scan/Upload
      │
      ▼
┌─────────────────────┐
│ Coda Documenti      │──► Scarto (blacklist mittente)
│ (Dashboard) [V5]    │──► Ignora
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ AI Inbox [V1]       │──► Analisi AI batch (5 doc)
│ (Classificazione)   │──► Suggerimento fornitore
│                     │──► Suggerimento tipo (fattura/bolla/listino/altro)
└─────────┬───────────┘
          │
          ├── Confidenza ≥95% → Auto-finalizzazione
          ├── Confidenza 60-95% → Attesa conferma manuale
          └── Confidenza <60% → Classificazione manuale
                    │
                    ▼
┌─────────────────────────┐
│ Abbinamenti Audit [V2]  │──► Se email non corrisponde
│ (Post-associazione)     │    → Riassegnazione manuale
└─────────────────────────┘
```

#### Flusso Statement → Triple-Check (P6)

```
Statement ricevuto via email
      │
      ▼
┌─────────────────────────┐
│ Statements: Da Proc.    │──► Associa fornitore
│ [Vf1]                   │──► Finalizza tipo statement
│                         │──► Converti in fattura
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Statements: Verifica    │──► Triple-check automatico
│ [Vf2]                   │    (Statement vs Fatture vs Bolle)
│                         │
│ Esiti possibili:        │
│   ✅ OK                 │──► Archiviazione
│   ❌ Fattura mancante   │──► Invia sollecito
│   ❌ Bolle mancanti     │──► Invia sollecito
│   ⚠️ Errore importo     │──► Verifica manuale
│   ⚠️ Prezzo Rekki disc. │──► Controllo listino
└─────────────────────────┘
```

#### Flusso Approvazione Fattura (P8)

```
Fattura creata (manuale/automatica)
      │
      ▼
┌─────────────────────────┐
│ Stato: pending          │
│ (in attesa approv.)     │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Coda Approvazioni [A1]  │──► Admin vede lista pending
│                         │
│ Opzioni:                │
│   🤖 Check & Approve AI│──► Gemini verifica documento
│   │                     │    ✅ OK → Approvata
│   │                     │    ❌ KO → Mostra motivo
│   │                     │
│   👍 Approva manuale    │──→ approval_status = 'approved'
│   │                          approved_by, approved_at
│   │
│   👎 Rifiuta (motivo)   │──→ approval_status = 'rejected'
│                              rejection_reason
│
│ Approvazione Bulk:      │
│   "Approva tutte con AI"│──→ Elabora 3 per volta
└─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│ Notifica Push           │
│ Log Attività [Au1]      │
│ Badge Stato [A3]        │
└─────────────────────────┘
```

### 6.3 Navigazione all'interno del Dettaglio Fornitore [M2]

```
┌─────────────────────────────────────────────────────────┐
│              DETTAGLIO FORNITORE                         │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬────┐│
│  │Riep. │Ordini│Bolle │Fatt. │Verif.│List. │Doc.  │Aud ││
│  │[M2]  │[M2]  │[Vf7] │[M3]  │[Vf4] │[R6]  │[Vf5] │[Au2]│
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────┴────┘│
│                                                          │
│  Ogni tab:                                               │
│  - KPI numerici specifici                                │
│  - Collegamenti a detail (/fatture/[id], /bolle/[id])    │
│  - Navigatore anno fiscale                               │
└──────────────────────────────────────────────────────────┘
```

---

## 7. STIMA DEL CARICO DI LAVORO PER UTENTE/TIPO DOCUMENTO

### 7.1 Stima Carico Operatore per Tipo Documento (giornaliero)

| Tipo Documento | Volume Medio | Tempo/Unità | Carico Giornaliero | Fase di Controllo |
|---|---|---|---|---|
| **Fattura** (da email) | 20-50/giorno | 2-5 min | 40-250 min | Validazione -> Associazione -> Approvazione |
| **Bolla/DDT** | 10-30/giorno | 1-3 min | 10-90 min | Validazione -> Associazione |
| **Estratto conto** (statement) | 3-10/giorno | 5-15 min | 15-150 min | Verifica -> Triple-check -> Solleciti |
| **Conferma ordine** | 5-15/giorno | 1-2 min | 5-30 min | Validazione -> Associazione |
| **Listino prezzi** | 1-5/giorno | 2-5 min | 2-25 min | Validazione -> Verifica prezzi |
| **Altro/Non classificato** | 5-15/giorno | 1-3 min | 5-45 min | Validazione -> Scarto/Classificazione |

**Carico totale stimato per operatore:** 77-590 min/giorno (1.3-9.8 ore)

### 7.2 Stima Carico Admin/Sede per Attività di Controllo

| Attività | Frequenza | Tempo/Unità | Carico Settimanale |
|---|---|---|---|
| Approvazione fatture | Giornaliera | 10-30 min | 50-150 min |
| Revisione anomalie triple-check | Giornaliera | 15-30 min | 75-150 min |
| Gestione duplicati | Settimanale | 10-20 min | 10-20 min |
| Verifica qualità associazioni | Settimanale | 20-40 min | 20-40 min |
| Configurazione e monitoraggio | Mensile | 30-60 min | 7-15 min |
| Audit e activity log review | Settimanale | 10-20 min | 10-20 min |
| Gestione fornitori potenziali | Settimanale | 10-20 min | 10-20 min |

### 7.3 Automazione AI — Riduzione Carico Stimata

| Processo | Automazione | Riduzione Carico |
|---|---|---|
| Classificazione tipo documento | Gemini AI (soglia 95%) | ~60-70% |
| Suggerimento fornitore | OCR + AI + storico email | ~50-60% |
| Approvazione fattura | AI check & approve | ~40-50% |
| Rilevamento duplicati | AI pattern matching | ~80-90% |
| Triple-check riconciliazione | Algoritmico (non AI) | ~90-95% |
| Scarto automatico (tipo "altro") | AI (soglia 60%) | ~20-30% |

---

## 8. API ENDPOINT DI CONTROLLO DOCUMENTALE

### 8.1 Endpoint di Validazione

| Endpoint | Metodo | Scopo | Scheda |
|---|---|---|---|
| `POST /api/documenti-da-processare` | POST | Lista/crud documenti in coda | V1, V5 |
| `POST /api/admin/reprocess-pending-docs` | POST | Riprocessa documenti pending con AI | V1 |
| `POST /api/documenti-da-processare` (scarta) | POST | Scarta/ignora documento | V1, V5 |
| `POST /api/email-blacklist` | POST | Gestione blacklist mittenti | V7 |
| `POST /api/ocr-scarto-rules` | POST | Regole scarto OCR | V8 |
| `GET /api/duplicates/document` | GET | Rilevamento duplicati | V3, V4 |
| `DELETE /api/duplicates/delete` | DELETE | Eliminazione duplicati | V3, V4 |
| `POST /api/quick-scan/ocr` | POST | OCR rapido | V6 |
| `POST /api/quick-scan/save` | POST | Salvataggio scan rapido | V6 |

### 8.2 Endpoint di Verifica

| Endpoint | Metodo | Scopo | Scheda |
|---|---|---|---|
| `GET /api/statements` | GET | Lista statements/estratti conto | Vf1-Vf3 |
| `POST /api/statements` | POST | Elaborazione statement | Vf1 |
| `POST /api/statements/convert-to-invoice` | POST | Converti statement in fattura | Vf1, Vf2 |
| `POST /api/process-pending-statements` | POST | Processa statements in attesa | Vf1 |
| `POST /api/triple-check-statement` | POST | Esecuzione triple-check | Vf2 |
| `POST /api/invia-sollecito` | POST | Invio sollecito fornitore | Vf2 |
| `PATCH /api/bolle` (stato) | PATCH | Cambio stato bolla | Vf6 |
| `POST /api/documenti-associati` | POST | Lista documenti associati | Vf1, Vf5 |

### 8.3 Endpoint di Approvazione

| Endpoint | Metodo | Scopo | Scheda |
|---|---|---|---|
| `GET /api/fatture/pending-approval` | GET | Lista fatture pending | A1 |
| `POST /api/fatture/approve` | POST | Approva/rifiuta fattura | A1 |
| `POST /api/fatture/check-and-approve` | POST | AI check & approve | A1 |
| `GET /api/sedi/[id]/approval-settings` | GET | Impostazioni approvazione | A2 |
| `POST /api/sedi/[id]/approval-settings` | POST | Salva impostazioni | A2 |

### 8.4 Endpoint di Revisione

| Endpoint | Metodo | Scopo | Scheda |
|---|---|---|---|
| `GET /api/centro-operazioni/dashboard` | GET | Dashboard stato sistema | R1 |
| `POST /api/centro-operazioni/force-cleanup` | POST | Forza cleanup | R1 |
| `GET /api/admin/document-processing-audit` | GET | Audit elaborazione | R3 |
| `GET /api/documenti-associati` | GET | Lista associazioni | R4 |
| `POST /api/documenti-associati/categoria/batch` | POST | Cambio categoria bulk | R9 |
| `GET /api/documenti-associati/learning` | GET | Pattern learning | R4 |
| `GET /api/listino/price-intelligence` | GET | Price intelligence | R2, R6 |
| `POST /api/listino/importa-da-rekki` | POST | Sync listino Rekki | R6 |
| `POST /api/retry-log/[id]` | POST | Riprocessa log errore | R3 |
| `POST /api/admin/reprocess-log-documents` | POST | Riprocessa documenti | R3 |

### 8.5 Endpoint di Audit

| Endpoint | Metodo | Scopo | Scheda |
|---|---|---|---|
| `GET /api/activity-log` | GET | Activity log timeline | Au1 |
| `GET /api/analytics/overview` | GET | KPI analytics | Au3 |
| `GET /api/gemini/usage` / `/admin/ai-usage` | GET | Consumi AI | Au4 |
| `GET /api/operator-workspace-header` | GET | KPI workspace | M1 |

---

## 9. WORKFLOW COMPLETI DI CONTROLLO

### 9.1 Ciclo di Vita Completo del Documento (Fattura)

```
1. ARRIVO
   ├── Email (IMAP Sync) ───► documenti_da_processare (stato: da_associare)
   ├── Scan (QuickScan) ────► documenti_da_processare (stato: da_associare)
   └── Upload manuale ──────► documenti_da_processare (stato: da_associare)
         │
2. VALIDAZIONE (AI INBOX)
   ├── OCR estrazione dati
   ├── AI classificazione tipo (Gemini)
   ├── Suggerimento fornitore (AI + storico)
   ├── Rilevamento duplicati
   │
   ├── [Confidenza ≥95%] → Auto-registrazione
   │   └── Fornitore match:   stato → associato
   │       └── Tipo fattura:  creazione fattura (stato: da_pagare)
   │
   ├── [Confidenza 60-95%] → Attesa conferma operatore
   │   └── Operatore conferma → stessa procedura sopra
   │
   └── [Confidenza <60% o errore] → Classificazione manuale
       └── Operatore decide tipo/fornitore/scarto
             │
3. ASSOCIAZIONE FORNITORE
   ├── Manuale: selezione fornitore esistente o creazione nuovo
   ├── Se email sconosciuta → Tab Audit abbinamenti [V2]
   └── Se fornitore non trovato → Suggerito come fornitore potenziale
         │
4. REGISTRAZIONE
   ├── Creazione record fattura (se tipo=fattura)
   ├── Creazione record bolla (se tipo=bolla)
   ├── Creazione conferma ordine (se tipo=ordine)
   └── Se tipo=statement → Reindirizzato a statements
         │
5. APPROVAZIONE (se richiesta)
   ├── [require_approval=ON] → approval_status = 'pending'
   │   ├── Sotto soglia importo → Auto-approvata
   │   └── Sopra soglia → In coda approvazioni
   │
   ├── Approved (AI check) → fattura.approval_status = 'approved'
   ├── Approved (manuale)   → fattura.approval_status = 'approved'
   ├── Rejected (manuale)   → fattura.approval_status = 'rejected'
   └── [require_approval=OFF] → Nessun controllo approvazione
         │
6. RICONCILIAZIONE (se estratto conto presente)
   ├── Triple-check: Statement vs Fatture vs Bolle
   ├── Esito OK → Archiviazione
   ├── Esito anomalia → Sollecito fornitore
   └── Esito errore prezzo → Verifica listino
         │
7. ARCHIVIAZIONE & AUDIT
   ├── Activity log: tutte le operazioni tracciate [Au1]
   ├── AI usage log: consumi AI registrati [Au4]
   └── Conservazione file: policy retention per sede
```

### 9.2 Workflow di Riconciliazione (Triple-Check)

```
STRATO 1: Acquisizione
┌─────────────────────────────────────────────────┐
│  Statement ricevuto (estratto conto PDF via email)│
│  → OCR estrazione righe (numero documento,       │
│    importo, data, fornitore)                     │
│  → documenti_da_processare (tipo=statement)       │
│  → statement_rows (righe estratte)               │
└──────────────────────┬──────────────────────────┘
                       │
STRATO 2: Matching     ▼
┌─────────────────────────────────────────────────┐
│  Triple-check automatico:                        │
│                                                  │
│  Per ogni riga statement:                        │
│  1. Cerca fattura con numero_documento match     │
│     ├── Trovata → Confronta importo              │
│     │   ├── Match → ✅ OK                        │
│     │   └── Mismatch → ⚠️ errore_importo         │
│     └── Non trovata → ❌ fattura_mancante         │
│                                                  │
│  2. Cerca bolle nel periodo del fornitore        │
│     ├── Tutte con fattura → ✅ OK                │
│     └── Bolle senza fattura → ❌ bolle_mancanti   │
│                                                  │
│  3. Se fornitore Rekki → Confronta prezzi        │
│     ├── Prezzo OK → ✅ OK                        │
│     └── Prezzo discorde → ⚠️ rekki_prezzo_disc.  │
└──────────────────────┬──────────────────────────┘
                       │
STRATO 3: Azioni       ▼
┌─────────────────────────────────────────────────┐
│  Per esito anomalia:                             │
│  ├── Invia sollecito fornitore (email)           │
│  ├── Converti statement in fattura (manuale)     │
│  └── Ri-analisi dopo ricezione documenti         │
│                                                  │
│  Per esito OK:                                   │
│  └── Archiviazione automatica                    │
└─────────────────────────────────────────────────┘
```

---

## 10. LACUNE IDENTIFICATE E RACCOMANDAZIONI

### 10.1 Lacune di Controllo

| # | Lacuna | Impatto | Scheda Coinvolta | Raccomandazione |
|---|---|---|---|---|
| L1 | Dettaglio fattura: nessuna visualizzazione stato approvazione | L'admin non può vedere/agire sullo stato approvazione dal dettaglio fattura | M3 | Aggiungere ApprovalBadge e pulsanti approva/rifiuta nel dettaglio fattura |
| L2 | Lista fornitori: nessuna integrazione workflow documentale | L'operatore non vede quante fatture pending/ha approvato per fornitore | Fornitori page | Aggiungere badge conteggi (fatture pending, da approvare, anomalie) sulle card fornitore |
| L3 | Nessuna pagina di riconciliazione dedicata | La riconciliazione è solo un KPI analytics, non esiste interfaccia operativa | — | Creare pagina `/riconciliazione` con vista operativa bolla-per-bolla |
| L4 | Audit fornitore: non registra azioni di approvazione | Manca tracciabilità di chi ha approvato/rifiutato nel tab audit del fornitore | Au2 | Arricchire activity log con azioni di approvazione collegate al fornitore |
| L5 | AI Inbox: nessun filtro per data/fornitore/importo | L'operatore non può filtrare la coda documenti | V1 | Aggiungere filtri avanzati (periodo, fornitore, tipo, range importo) |
| L6 | Notifiche: solo push, nessuna notifica in-app per anomalie | L'operatore deve navigare manualmente per vedere le anomalie | M1 | Aggiungere notifiche in-app (badge, toast) per nuove anomalie/approvazioni pendenti |

### 10.2 Raccomandazioni Architetturali

| # | Raccomandazione | Priorità | Sforzo Stimato |
|---|---|---|---|
| R1 | Unificare il sistema di notifiche (push + in-app + email) | Alta | 3-5 giorni |
| R2 | Aggiungere dashboard personalizzata per ruolo (vista admin vs operatore differenziata) | Media | 5-7 giorni |
| R3 | Implementare sistema di code di priorità per documenti urgenti (scadenze imminenti) | Alta | 3-4 giorni |
| R4 | Creare vista riconciliazione operativa bolla-per-bolla | Media | 4-6 giorni |
| R5 | Aggiungere export report periodici (settimanali/mensili) di controllo documentale | Bassa | 2-3 giorni |
| R6 | Migliorare sistema di pattern learning per suggerimenti azioni (attualmente base) | Media | 5-8 giorni |
| R7 | Implementare audit trail immutabile per conformità normativa | Alta | 4-6 giorni |

---

## 11. APPENDICE: DATABASE SCHEMA RILEVANTE

### 11.1 Stati Workflow Documentali

```sql
-- documenti_da_processare.stato
'da_associare'   -- Default iniziale
'bozza_creata'   -- Bozza di fattura/bolla creata
'associato'      -- Associato a fornitore
'scartato'       -- Scartato/ignorato
'da_revisionare' -- Richiede revisione manuale (ex mittente_sconosciuto)

-- fatture.stato
'da_pagare'      -- In attesa di pagamento
'pagata'         -- Pagata
'scaduta'        -- Scaduta
'annullata'      -- Annullata

-- fatture.approval_status (non è enum SQL, ma campo text)
'pending'        -- In attesa di approvazione
'approved'       -- Approvata
'rejected'       -- Rifiutata (con rejection_reason)

-- bolle.stato
'in attesa'      -- Non ancora completata
'completato'     -- Completata/ricevuta

-- statement_rows.check_status
'pending'                  -- In attesa di verifica
'ok'                       -- Verifica superata
'fattura_mancante'        -- Fattura non trovata
'bolle_mancanti'          -- Bolle non trovate
'errore_importo'          -- Importo discordante
'rekki_prezzo_discordanza' -- Prezzo Rekki non corrispondente

-- documenti_da_processare.categoria
'fiscale'      -- Documento fiscale
'non_fiscale'  -- Documento non fiscale (default)
```

### 11.2 Tabella Attori (profiles.role)

```sql
'admin'         -- Admin Master (accesso globale)
'admin_sede'    -- Admin di Sede (accesso per sede_id)
'operatore'     -- Operatore base (accesso limitato alla sede)
```

### 11.3 Azioni Tracciate (attivita.azione)

```sql
'documento_letto'          -- Documento visualizzato
'documento_scartato'       -- Documento scartato
'documento_associato'      -- Documento associato a fornitore
'documento_elaborato'      -- Documento elaborato
'documento_approvato'      -- Documento approvato
'fornitore_creato'         -- Nuovo fornitore creato
'fornitore_aggiornato'     -- Fornitore modificato
'fattura_creata'           -- Nuova fattura registrata
'fattura_approvata'        -- Fattura approvata/rifiutata
'bolla_creata'             -- Nuova bolla registrata
'utente_invitato'          -- Nuovo utente invitato
'utente_rimosso'           -- Utente rimosso
'aggiorna_categoria'       -- Categoria documento modificata
```

---

## FINE REPORT

**Totale schede mappate:** 34
**Tipologie di controllo:** 5 (Validazione, Verifica, Approvazione, Revisione, Audit)
**Ruoli coinvolti:** 3 (admin, admin_sede, operatore)
**API endpoint di controllo:** 30+
**Processi di controllo documentale:** 12
**Lacune identificate:** 6
**Raccomandazioni:** 7

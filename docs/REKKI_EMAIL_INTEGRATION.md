# Rekki Order Email Integration

## Panoramica

Sistema automatico per estrarre dati dalle email di conferma ordine Rekki e sincronizzarli con il listino prezzi e le fatture.

## Funzionalità

### 1. Estrazione Automatica da Email
- **Parser intelligente**: Riconosce automaticamente formati come:
  - `2 x Salmon fillet @ £12.50`
  - `3 × Tomatoes @ £4.20`
  - `Prodotto  Qty  12.50` (formato tabellare)
- **Supporto multi-formato**: HTML e testo piano
- **Estrazione completa**: Prodotto, quantità, prezzo unitario e totale riga

### 2. Auto-Mapping nel Listino
Quando viene processata un'email di conferma ordine:
- **Prodotti esistenti**: Aggiorna il prezzo nel `listino_prezzi` con la data corrente
- **Nuovi prodotti**: Crea automaticamente una nuova riga nel listino
- **Tracciabilità**: Aggiunge note indicando la provenienza da ordine Rekki

### 3. Triple-Check Automatico
- Crea uno "statement" con le righe estratte dall'ordine
- Confronta automaticamente con tutte le fatture del fornitore
- Segnala discrepanze prezzo (Rekki vs Fattura) > 5%
- Identifica fatture che non corrispondono a ordini Rekki

## Architettura

```
Email Rekki (orders@rekki.com)
    ↓
parseRekkiFromEmailParts()
    ↓
[prodotto, qty, prezzo_unitario]
    ↓
    ├─→ Update listino_prezzi (auto-mapping)
    │
    └─→ persistRekkiOrderStatement()
            ↓
        runTripleCheck()
            ↓
        [Confronto con fatture]
```

## File Coinvolti

### Backend
- **`/api/rekki/process-order-email/route.ts`**: Endpoint per processare email Rekki
- **`/lib/rekki-parser.ts`**: Parser per email di conferma ordine
- **`/lib/rekki-statement.ts`**: Persistenza ordini come statements
- **`/lib/triple-check.ts`**: Confronto ordini Rekki vs fatture

### Frontend
- **`/components/RekkiOrderEmailProcessor.tsx`**: UI per processare email manualmente
- **`/components/RekkiSupplierIntegration.tsx`**: Configurazione Rekki del fornitore
- **`/components/RecuperoCreditiAudit.tsx`**: Audit storico prezzi Rekki

### Database
- **`listino_prezzi.rekki_product_id`**: Collega prodotti a ID Rekki specifici
- **`statements` / `statement_rows`**: Ordini Rekki salvati per confronto
- **`fornitori.rekki_supplier_id`**: ID fornitore Rekki
- **`fornitori.rekki_link`**: Link profilo Rekki

## API Endpoint

### POST `/api/rekki/process-order-email`

Processa un'email di conferma ordine Rekki.

**Request Body:**
```json
{
  "fornitore_id": "uuid",
  "email_body": "2 x Salmon fillet @ £12.50\n3 x Tomatoes @ £4.20",
  "email_subject": "Order Confirmation - #12345",
  "email_html": "<html>...</html>",
  "file_url": "https://...",
  "data_ordine": "2026-04-16"
}
```

**Response:**
```json
{
  "result": {
    "success": true,
    "productsExtracted": 2,
    "productsUpdated": 1,
    "productsCreated": 1,
    "statementId": "uuid",
    "lines": [
      {
        "prodotto": "Salmon fillet",
        "quantita": 2,
        "prezzo_unitario": 12.50,
        "importo_linea": 25.00,
        "action": "updated",
        "listinoId": "uuid",
        "previousPrice": 11.80
      }
    ]
  }
}
```

## Flusso di Utilizzo

### 1. Configurazione Iniziale
1. Aprire pagina dettaglio fornitore
2. Nella sezione "Integrazione Rekki", inserire:
   - **Rekki Supplier ID** (es: `berkeley-wines-uk`)
   - **Rekki Link** (es: `https://app.rekki.com/supplier/berkeley-wines-uk`)

### 2. Processare Email Manualmente
1. Copiare il testo dell'email di conferma ordine Rekki
2. Incollarlo nella sezione "Importa Ordine Rekki da Email"
3. Cliccare "Processa Ordine Rekki"
4. Vedere il riepilogo:
   - Prodotti estratti
   - Prodotti aggiornati nel listino
   - Nuovi prodotti creati
   - Statement ID per triple-check

### 3. Scanning Automatico (già integrato)
Le email Rekki vengono automaticamente:
- Riconosciute durante lo scan email (`isLikelyRekkiEmail()`)
- Parsate e salvate come statements
- Confrontate con le fatture esistenti

## Audit e Controllo Prezzi

### Visualizzazione Anomalie
Nel tab "Audit Prezzi" del fornitore:
- **Prezzo Rekki confermato**: Da ordini Rekki estratti
- **Prezzo fattura effettivo**: Da fatture caricate
- **Delta %**: Differenza percentuale
- **Spreco totale**: Importo extra pagato (se prezzo fattura > Rekki)

### Esportazione CSV
- Click su "Esporta CSV" per scaricare report completo
- Include: data fattura, prodotto, prezzi, delta, quantità

## Logica di Matching

### Prodotti nel Listino
1. **Exact match by rekki_product_id**: Se presente, priorità massima
2. **Fuzzy match by name**: Normalizza e confronta nomi prodotti
   - Es: "Salmon fillet" ↔ "salmon-fillet" ↔ "SALMON FILLET"

### Confronto Prezzi (Triple-Check)
- **Tolleranza**: ±5% considerato accettabile
- **Anomalia**: Delta > 5% tra prezzo Rekki e fattura
- **Alert**: Segnalazione visiva (rosso) se prezzo pagato > prezzo pattuito

## Pattern Email Riconosciuti

### Formato "Qty x Prodotto @ Prezzo"
```
2 x Salmon fillet @ £12.50
3 × Tomatoes @ £4.20
5 x Olive oil @ €8.90
```

### Formato Tabellare
```
Product         Qty    Price
Salmon fillet    2     12.50
Tomatoes         3      4.20
```

### Formato "Prodotto Qty Prezzo"
```
Salmon fillet  2  12.50
Tomatoes       3   4.20
```

## Vantaggi

1. **Risparmio tempo**: Nessuna digitazione manuale prezzi
2. **Tracciabilità**: Ogni prezzo ha data e origine (ordine Rekki)
3. **Controllo qualità**: Segnalazione automatica discrepanze
4. **Audit storico**: Calcolo spreco totale su periodo
5. **Integrazione completa**: Da email → listino → confronto fattura

## Esempio Completo

### Email Ricevuta (orders@rekki.com)
```
Subject: Order Confirmation - Osteria Basilico #ORD-12345

2 x Fresh Salmon Fillet @ £12.50
3 x Organic Tomatoes @ £4.20
1 x Extra Virgin Olive Oil @ £8.90

Total: £38.50
```

### Risultato Processing
- **Salmon Fillet**: Prezzo aggiornato da £11.80 → £12.50 (✅ aggiornato)
- **Organic Tomatoes**: Prezzo aggiornato da £4.00 → £4.20 (✅ aggiornato)
- **Olive Oil**: Prodotto nuovo creato a £8.90 (➕ creato)

### Statement Creato
- ID: `stmt_xyz123`
- Tipo: `Ordine Rekki`
- Righe: 3
- Status: `done`

### Triple-Check
Quando arriva la fattura `INV-789`:
- **Salmon**: Fattura £12.50 vs Rekki £12.50 → ✅ OK
- **Tomatoes**: Fattura £4.50 vs Rekki £4.20 → ⚠️ +7.1% ANOMALIA
- **Olive Oil**: Fattura £8.90 vs Rekki £8.90 → ✅ OK

**Alert generato**: Tomatoes sovrapprezzati di £0.30 × 3 = £0.90 spreco

## Limitazioni Note

1. **Parser**: Funziona solo con formati standard Rekki
   - Email custom o formati non standard potrebbero non essere riconosciuti
2. **Matching prodotti**: Basato su nome (fuzzy match)
   - Prodotti con nomi molto diversi potrebbero non essere abbinati
3. **Multi-valuta**: Supporta £, €, $ ma non converti automaticamente
4. **Quantità frazionate**: Supporta decimali (es: 2.5)

## Roadmap Futura

- [ ] Integrazione Gmail API per fetch automatico email Rekki
- [ ] Machine learning per migliorare matching prodotti
- [ ] Dashboard Rekki dedicata con KPI aggregati
- [ ] Notifiche push per anomalie prezzo >10%
- [ ] Supporto multi-lingua per parser (IT, FR, DE, ES)

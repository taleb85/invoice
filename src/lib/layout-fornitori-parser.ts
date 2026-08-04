/**
 * Registro dei layout fattura per fornitore.
 * Ogni layout definisce come estrarre le righe prodotto dal testo PDF.
 *
 * Layout conosciuti (ognuno con pattern regex a gruppi indicizzati):
 * - hallgarten_vino:    CODE  DESC  ALC%  QTY  PACK  UNITPRICE  VALUE
 * - carnevale:          CODE  DESC  QTY  WEIGHT  UOM  UNITPRICE  AMOUNT  DISC%  LINETOTAL  VAT
 * - mondial_wine:       CODE  DESC  QTY  PACK  LISTPRICE  UOM  UNITPRICE  AMOUNT
 * - capital_seafoods:   QTY  (CODE)  DESC  UNITPRICE  NETAMT  VAT%  VAT
 * - hildon:             CODE  DESC  QTY  PRICE  TOTAL
 * - saggiomo:           DESC  QTY  RATE  AMOUNT
 * - generico:           fallback — prova pattern comuni
 */

export interface LayoutProfilo {
  nome: string
  firma: RegExp
  // Pattern riga: regex con gruppi indicizzati
  pattern: RegExp
  // Ordine dei gruppi nel pattern → campo
  gruppi: (keyof ParsedLine | null)[]
  // La riga può continuare su più linee PDF (es. Mondial Wine)
  multiriga: boolean
  // Per multiriga: come capire se una linea è continuazione
  lineaContinuazione?: RegExp
  // Quantità di default se assente dal pattern (es. 1 per A&F Gelati)
  quantitaDefault?: number
}

export interface ParsedLine {
  codice_prodotto: string | null
  prodotto: string
  prezzo: number
  quantita: number
  importo_linea: number | null
  unita: string | null
  aliquota_iva: number | null
}

function parseMoney(s: string): number | null {
  const raw = String(s).replace(/[£€$,\s]/g, '').trim()
  const val = parseFloat(raw)
  return Number.isFinite(val) && val > 0 ? val : null
}

function parseQty(s: string): number {
  return parseFloat(String(s).replace(',', '.')) || 1
}

// ============================================================
// LAYOUT REGISTRY
// ============================================================
// Gruppi: [codice?, prodotto?, qty?, pack/unita?, prezzo?, importo_linea?]

export const LAYOUTS: LayoutProfilo[] = [
  // ── Hallgarten / Vino ──
  // 61811NVA Champagne Bernard Remy Brut Carte Blanche N.V 12 1 6X75cl 20.00 120.00
  // 5287919Y Vin Santo Del Chianti *50Cl* Cipriano 2019 -Bonacchi 15.5 2 6X50cl 15.06 180.72
  // Gruppi: 1=codice, 2=prodotto, 3=alc(ignorato), 4=qty, 5=pack, 6=prezzo, 7=importo
  {
    nome: 'hallgarten_vino',
    firma: /Hallgarten\s+Wines|hnwines\.co\.uk|Mulberry\s+House/i,
    pattern: /^(\S+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+\s*[xX×]\s*\d+\s*(?:cl|ml|l|CL|ML|L)?)\s+(\d{1,7}[.,]\d{2})\s+(\d{1,7}[.,]\d{2})\s*$/i,
    gruppi: ['codice_prodotto', 'prodotto', null, 'quantita', 'unita', 'prezzo', 'importo_linea'],
    multiriga: true,
    lineaContinuazione: /^(?!\d|$|\S+\d)/,
  },

  // ── C Carnevale ──
  // CH565 FIORDILATTE MOZZ. TIPO AGEROLA JULIENNE MASANIELLO 4X 2.5kg 1.00 Case £ 80.60 £ 80.60 12.50 % £ 70.52 VAT0
  // Gruppi: 1=codice, 2=prodotto, 3=qty, 4=pack, 5=prezzo, 6=importo
  {
    nome: 'carnevale',
    firma: /C\s+CARNEVALE|CARNEVALE\s+HOUSE|Blundell\s+St/i,
    pattern: /^([A-Z]{2,4}\d{2,6})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(?:\d+(?:[.,]\d+)?\s+)?(Case|Pack|Each|KG|Box)\s+£\s*(\d+(?:[.,]\d+)?)\s+£\s*(\d+(?:[.,]\d+)?)\s+\d+(?:[.,]\d+)?\s*%\s*£\s*\d+(?:[.,]\d+)?\s*(?:VAT\d+)?/i,
    gruppi: ['codice_prodotto', 'prodotto', 'quantita', 'unita', 'prezzo', 'importo_linea'],
    multiriga: true,
    lineaContinuazione: /^[A-Z]+\d/i,
  },

  // ── Mondial Wine ──
  // 10935_2023 SANTA SOFIA RIPASSO DELLA VALPOLICELLA SUPERIORE DOC   18 Bottles  12.83  12.83  230.94
  // Gruppi: 1=codice, 2=prodotto, 3=qty, 4=pack, 5=listprice(ign), 6=prezzo, 7=importo
  {
    nome: 'mondial_wine',
    firma: /MONDIAL\s+WINE|Bletchingley\s+Road|RH1\s+4HW/i,
    pattern: /^(\d+_\d{4})\s+(.+?)\s+(\d+)\s+(Bottles?|Cases?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*$/i,
    gruppi: ['codice_prodotto', 'prodotto', 'quantita', 'unita', null, 'prezzo', 'importo_linea'],
    multiriga: true,
    lineaContinuazione: /^(?!\d+_|$|Bank|HSBC|Total|VAT)/,
  },

  // ── Capital Seafoods ──
  // 4.100 (0TS0) TUNA SASHIMI GRADE (Kg) 18.950 77.70 0.00 0.00
  // Gruppi: 1=qty, 2=codice, 3=prodotto, 4=pack, 5=prezzo, 6=importo
  {
    nome: 'capital_seafoods',
    firma: /capital\s+seafoods|MITRE\s+BRIDGE/i,
    pattern: /^(\d+(?:[.,]\d+)?)\s+\(([^)]+)\)\s+(.+?)\s+\(([^)]+)\)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+\d+(?:[.,]\d+)?\s+\d+(?:[.,]\d+)?\s*$/i,
    gruppi: ['quantita', 'codice_prodotto', 'prodotto', 'unita', 'prezzo', 'importo_linea'],
    multiriga: false,
  },

  // ── Hildon ──
  // 75GS12 750ml Hildon Still Glass x 12 7.00 9.37 65.59
  // Gruppi: 1=codice, 2=prodotto, 3=qty, 4=prezzo, 5=importo
  {
    nome: 'hildon',
    firma: /Hildon\s+Ltd|hildon@hildon\.com|Broughton\s+SO20/i,
    pattern: /^([A-Z0-9]{4,8})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*$/i,
    gruppi: ['codice_prodotto', 'prodotto', 'quantita', 'prezzo', 'importo_linea'],
    multiriga: false,
  },

  // ── Saggiomo Luxury Foods ──
  // Welsh Mussels (Mytilus Edulis) - 1kg bags 4 3.00 12.00
  // Gruppi: 1=prodotto, 2=qty, 3=prezzo, 4=importo
  {
    nome: 'saggiomo',
    firma: /Saggiomo\s+Luxury|Beddington\s+Lane/i,
    pattern: /^(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*$/i,
    gruppi: ['prodotto', 'quantita', 'prezzo', 'importo_linea'],
    multiriga: false,
  },

  // ── La Tua Pasta ──
  // TA01 1 1KG TAGLIATELLE EGG 1KG £7.42 10.00 £6.68
  // Gruppi: 1=codice, 2=qty, 3=pack, 4=prodotto, 5=prezzo, 6=importo(net)
  {
    nome: 'la_tua_pasta',
    firma: /La\s+Tua\s+Pasta|latuapasta\.com|Nucleus\s+Park/i,
    pattern: /^([A-Z]{2,4}\d{2,4})\s+(\d+(?:[.,]\d+)?)\s+(\S+)\s+(.+?)\s+£\s*(\d+(?:[.,]\d+)?)\s+(?:\d+(?:[.,]\d+)?)\s+£\s*(\d+(?:[.,]\d+)?)\s*$/i,
    gruppi: ['codice_prodotto', 'quantita', 'unita', 'prodotto', 'prezzo', 'importo_linea'],
    multiriga: false,
  },

  // ── Enotria Winecellars ──
  // 25366125 Gavi di Gavi Minaia 25 Bergaglio 6/75 5 6x75cl 62.64 313.22
  // Gruppi: 1=codice, 2=prodotto, 3=pack_desc, 4=qty, 5=pack, 6=prezzo, 7=importo
  {
    nome: 'enotria_wine',
    firma: /Enotria\s+Winecellars|Cumberland\s+Avenue|NW10\s+7RX/i,
    pattern: /^(\d+[A-Z]?\d*)\s+(.+?)\s+(\d+\/\d+)\s+(\d+)\s+(\d+\s*[xX×]\s*\d+\s*(?:cl|ml|l)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*$/i,
    gruppi: ['codice_prodotto', 'prodotto', null, 'quantita', 'unita', 'prezzo', 'importo_linea'],
    multiriga: false,
  },

  // ── Berkmann Wine Cellars ──
  // 541140-NV Prosecco Extra Dry, Serena 1881 NV 75cl 9.547 6 57.28
  // Gruppi: 1=codice, 2=prodotto, 3=vintage, 4=unit, 5=prezzo, 6=qty, 7=importo
  {
    nome: 'berkmann_wine',
    firma: /Berkmann\s+Wine|Rosebery\s+Avenue|70\s+Rosebery/i,
    pattern: /^(\d+[A-Z]*-[A-Z]+)\s+(.+?)\s+(?:NV\s+)?(\d+.+?)\s+(\S+)\s+(\d+(?:[.,]\d+)?)\s+(\d+)\s+(\d+(?:[.,]\d+)?)\s*$/i,
    gruppi: ['codice_prodotto', 'prodotto', null, 'unita', 'prezzo', 'quantita', 'importo_linea'],
    multiriga: false,
  },

  // ── Donovan Bros ──
  // CLIN01 25.38    ROLL    6.00    30cmx300M CLING FILM CUTTER BX 32C08-8 4.23
  // MW8000TR 64.96   X400    1.00    M8000TR CLEAR FLAT LIDS for M8000 64.96
  // Columns: CODE, LINE_TOTAL, PACK, QTY, DESC, UNIT_PRICE
  // Gruppi: 1=codice, 2=importo, 3=pack, 4=qty, 5=prodotto, 6=prezzo
  {
    nome: 'donovan_bros',
    firma: /Donovan\s+Bros|Lagoon\s+Road|Orpington|BR5\s+3QX/i,
    pattern: /^([A-Z]{2,6}\d{2,5}[A-Z]{0,3})\s+(\d+(?:[.,]\d+)?)\s+(\S+)\s+(\d+(?:[.,]\d+)?)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*$/i,
    gruppi: ['codice_prodotto', 'importo_linea', null, 'quantita', 'prodotto', 'prezzo'],
    multiriga: false,
  },

  // ── G Lawrence Wholesale Meat ──
  // 200004 VEAL FILLETS 4 WGT 3.60 KGS 30.00 KGS 108.00
  // Gruppi: 1=codice, 2=prodotto, 3=qty, 4=pack, 5=peso, 6=prezzo, 7=uom, 8=importo
  {
    nome: 'g_lawrence_meat',
    firma: /G\s+Lawrence\s+Wholesale|Smithfield|glawrencemeats/i,
    pattern: /^(\d{5,8})\s+(.+?)\s+(\d+)\s+(WGT|PACK|KG)\s+(\d+(?:[.,]\d+)?)\s+(KGS|KG)\s+(\d+(?:[.,]\d+)?)\s+(KGS|KG)\s+(\d+(?:[.,]\d+)?)\s*$/i,
    gruppi: ['codice_prodotto', 'prodotto', 'quantita', null, null, null, 'prezzo', null, 'importo_linea'],
    multiriga: false,
  },

  // ── Alivini Group ──
  // £134.40 4 SAFFRON CHIQUILIN 50x125mg PACKETS    UNITS   SZ      £33.60  £37.33
  // Gruppi: 1=importo_netto, 2=qty, 3=prodotto, 4=pack, 5=vatcode, 6=prezzo, 7=listino
  {
    nome: 'alivini',
    firma: /Alivini\s+Group|Eade\s+Road|N4\s+1DN|cc@alivini\.com/i,
    pattern: /^£?\s*(\d+(?:[.,]\d+)?)\s+(\d+)\s+(.+?)\s+(UNITS?|PACKS?)\s+(S[ZS])\s+£?\s*(\d+(?:[.,]\d+)?)\s+£?\s*(\d+(?:[.,]\d+)?)\s*$/i,
    gruppi: ['importo_linea', 'quantita', 'prodotto', 'unita', null, 'prezzo', null],
    multiriga: false,
  },

  // ── A&F Gelati Italiani / Stella Coffee / Stella Imports ──
  // GELATO - VANILLA - 2L - SPECIAL 3(24/04) 3.00 14.15 20% 42.45
  // 8 M71001 Molinari Intenso Beans 1kg £13.90 £111.20 Z
  // Gruppi: 1=qty(opz), 2=codice(opz), 3=prodotto, 4=prezzo, 5=importo
  {
    nome: 'gelati_stella',
    firma: /A&F\s+Gelati|Ariela.s\s+Gelato|Stella\s+Imports|stellacoffeeandtea/i,
    // Supporta sia formato A&F (14.15 20% 42.45) che Stella (£13.90 £111.20 Z)
    // Esclude righe VAT/Company/Subtotal/Total
    pattern: /^(?:\d+\s+)?(?:[A-Z]\d{4,6}\s+)?(.+?)\s+£?\s*(\d+(?:[.,]\d+)?)\s+(?:\d+(?:[.,]\d+)?%?\s+)?£?\s*(\d+(?:[.,]\d+)?)(?:\s+[SZ])?\s*$/i,
    gruppi: ['prodotto', 'prezzo', 'importo_linea'],
    quantitaDefault: 1,
    multiriga: false,
  },

  // ── Ital Cutlery ──
  // 1.00 Knife Sharpening and Rental 20.00 20.00 20.00 4.00
  // Gruppi: 1=qty, 2=prodotto, 3=prezzo, 4=importo
  {
    nome: 'ital_cutlery',
    firma: /Ital\s+Cutlery|Wickham\s+Mews|enquiries@italcutlery/i,
    pattern: /^(\d+(?:[.,]\d+)?)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+\d+(?:[.,]\d+)?\s+\d+(?:[.,]\d+)?\s*$/i,
    gruppi: ['quantita', 'prodotto', 'prezzo', 'importo_linea'],
    multiriga: false,
  },

  // ── Generico (fallback) ──
  // Prova pattern comune: CODICE? DESCRIZIONE QTA QUALCOSA PREZZO TOTALE
  // Gruppi: 1=codice(opt), 2=prodotto, 3=qty, 4=prezzo, 5=importo
  {
    nome: 'generico',
    firma: /.*/,
    pattern: /^(?:(\S+)\s+)?(.+?)\s+(\d+(?:[.,]\d+)?)\s+(?:\S+\s+)?(\d{1,7}[.,]\d{2})\s+(\d{1,7}[.,]\d{2})\s*$/i,
    gruppi: ['codice_prodotto', 'prodotto', 'quantita', 'prezzo', 'importo_linea'],
    multiriga: false,
  },
]

// ============================================================
// AUTO-DETECTION
// ============================================================

/**
 * Data una stringa di testo PDF, restituisce il layout che matcha.
 * Restituisce null se nessun layout conosciuto matcha (userà Gemini).
 */
export function detectLayout(text: string): LayoutProfilo | null {
  const firstPage = text.substring(0, 3000)
  for (const layout of LAYOUTS) {
    if (layout.nome === 'generico') continue // mai auto-detectare il generico
    if (layout.firma.test(firstPage)) {
      return layout
    }
  }
  return null
}

/**
 * Ottiene il layout per un fornitore: prima dal DB, poi auto-detection, infine generico.
 */
export function getLayoutForFornitore(
  text: string,
  savedLayout: LayoutProfilo | null,
): LayoutProfilo {
  if (savedLayout) return savedLayout
  return detectLayout(text) ?? LAYOUTS[LAYOUTS.length - 1]! // generico
}

// ============================================================
// PARSING
// ============================================================

export interface ParsedInvoiceLine {
  codice_prodotto: string | null
  prodotto: string
  prezzo: number
  quantita: number
  importo_linea: number | null
  unita: string | null
  aliquota_iva: number | null
}

/**
 * Unisce linee multi-riga (es. Mondial Wine con descrizione su più linee).
 */
function mergeMultiline(lines: string[], layout: LayoutProfilo): string[] {
  if (!layout.multiriga) return lines
  const merged: string[] = []
  let current = ''
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    // Se matcha il pattern, è una nuova riga prodotto
    if (layout.pattern.test(t)) {
      if (current) merged.push(current)
      current = t
    } else if (current && layout.lineaContinuazione?.test(t)) {
      // È continuazione della descrizione
      current += ' ' + t
    }
    // Altrimenti scarta (header, footer, etc.)
  }
  if (current) merged.push(current)
  return merged
}

/**
 * Estrae le righe prodotto dal testo PDF usando il layout specificato.
 */
export function parseWithLayout(text: string, layout: LayoutProfilo): ParsedInvoiceLine[] {
  const lines = text.split('\n')
  const merged = mergeMultiline(lines, layout)
  const results: ParsedInvoiceLine[] = []
  const seen = new Set<string>()

  for (const line of merged) {
    // Salta righe note non-prodotto (VAT, intestazioni, subtotali, etc.)
    if (/^(?:VAT\s*(?:Reg|Registration|Code|Analysis|Rate)?\b|Company\s+Registration|SUBTOTAL|TOTAL\s+(?:GBP|TAX|VAT)|CARRIAGE|BALANCE\s+DUE|Grand\s+Total|Net\s+Total|Net\s+Amount|Invoice\s+Total|Payment\s+Due|Due\s+Date|Page\s+\d|Order\s+No|Order\s+Ref|Account\s+No|Bank\s+Details|Sort\s+Code|Account\s+Name|IBAN|SWIFT|BIC|Please\s+check|Reservation\s+of\s+Title)/i.test(line.trim())) continue
    const m = line.match(layout.pattern)
    if (!m) continue

    // m[0] = match intero, m[1..N] = gruppi
    const parsed: Partial<ParsedInvoiceLine> = {}
    for (let i = 0; i < layout.gruppi.length; i++) {
      const field = layout.gruppi[i]!
      if (field == null) continue // gruppo da ignorare
      const val = (m[i + 1] ?? '').trim()
      if (!val) continue

      switch (field) {
        case 'codice_prodotto':
          parsed.codice_prodotto = val || null
          break
        case 'prodotto':
          // Aggrega prodotto su più match (in caso di multi-match)
          parsed.prodotto = parsed.prodotto ? parsed.prodotto + ' ' + val : val
          break
        case 'prezzo': {
          const p = parseMoney(val)
          if (p != null) parsed.prezzo = p
          break
        }
        case 'quantita':
          parsed.quantita = parseQty(val)
          break
        case 'importo_linea': {
          const imp = parseMoney(val)
          if (imp != null) parsed.importo_linea = imp
          break
        }
        case 'unita':
          parsed.unita = (parsed.unita ? parsed.unita + ' ' + val : val) || null
          break
      }
    }

    // Validazione minima
    if (!parsed.prodotto || !parsed.prezzo || parsed.prezzo <= 0) continue
    if (!parsed.quantita || parsed.quantita < 0.01) parsed.quantita = layout.quantitaDefault ?? 1

    // Deduplica
    const key = (parsed.prodotto + '|' + parsed.prezzo).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    results.push({
      codice_prodotto: parsed.codice_prodotto ?? null,
      prodotto: parsed.prodotto,
      prezzo: parsed.prezzo,
      quantita: parsed.quantita,
      importo_linea: parsed.importo_linea ?? null,
      unita: parsed.unita ?? null,
      aliquota_iva: null,
    })
  }

  return results
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { extractEmailFromSenderHeader } from '@/lib/sender-email'
import { normalizeTipoDocumento, type NormalizedTipoDocumento } from '@/lib/ocr-tipo-documento'

export const OCR_SCARTO_RULE_TIPOS = ['mittente', 'dominio', 'parola_chiave', 'tipo_documento'] as const

export type OcrScartoRuleTipo = (typeof OCR_SCARTO_RULE_TIPOS)[number]

export type OcrScartoRuleRow = {
  id: string
  sede_id: string
  tipo: string
  valore: string
  motivo: string | null
  attivo: boolean
  creato_da: string | null
  created_at: string
}

/** Marker `errore_dettaglio` per chiudere lo skip anche in sync storico. */
export const OCR_SCARTO_RULE_LOG_MARKER = '[OCR_RULE_SCARTO]'

export function parseOcrScartoRuleTipo(raw: unknown): OcrScartoRuleTipo | null {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return (OCR_SCARTO_RULE_TIPOS as readonly string[]).includes(s) ? (s as OcrScartoRuleTipo) : null
}

/** Carica solo regole attive, ordinate (prime = precedenza). */
export async function loadActiveOcrScartoRulesForSede(
  service: SupabaseClient,
  sedeId: string,
): Promise<OcrScartoRuleRow[]> {
  const sid = sedeId?.trim()
  if (!sid) return []
  const { data, error } = await service
    .from('ocr_scarto_rules')
    .select('id, sede_id, tipo, valore, motivo, attivo, creato_da, created_at')
    .eq('sede_id', sid)
    .eq('attivo', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('[ocr_scarto_rules] load failed:', error.message)
    return []
  }
  return (data ?? []) as OcrScartoRuleRow[]
}

function normalizeRuleVal(v: string): string {
  return v.trim().toLowerCase()
}

function senderDomainFromHeader(raw: string | null | undefined): string | null {
  const e = extractEmailFromSenderHeader(raw)
  if (!e) return null
  const tail = e.split('@')[1]
  return tail?.trim().toLowerCase() || null
}

function normalizeDomainRuleVal(val: string): string {
  const v = val.trim().toLowerCase()
  return v.startsWith('@') ? v.slice(1) : v
}

export function matchMittenteRule(mittenteHeader: string, ruleVal: string): boolean {
  const want = normalizeRuleVal(ruleVal)
  if (!want) return false
  const lowHeader = mittenteHeader.trim().toLowerCase()
  const email = extractEmailFromSenderHeader(mittenteHeader)
  const lowEmail = email ?? ''
  return lowEmail === want || lowHeader.includes(want)
}

export function matchDominioRule(mittenteHeader: string, ruleVal: string): boolean {
  const dom = senderDomainFromHeader(mittenteHeader)
  const wantDom = normalizeDomainRuleVal(ruleVal)
  if (!dom || !wantDom) return false
  return dom === wantDom || dom.endsWith(`.${wantDom}`)
}

export async function attachmentPlainTextSnippetForKeywords(
  buf: Buffer,
  contentType: string | undefined,
  maxChars: number,
): Promise<string | null> {
  const mime = (contentType ?? '').split(';')[0].trim().toLowerCase()
  if (mime === 'application/pdf' || mime === '') {
    try {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: buf })
      try {
        const result = await parser.getText()
        const t = typeof result?.text === 'string' ? result.text : ''
        if (!t.trim()) return null
        return t.slice(0, maxChars).toLowerCase()
      } finally {
        await parser.destroy()
      }
    } catch {
      return null
    }
  }
  if (
    mime === 'text/plain' ||
    mime === 'application/xml' ||
    mime.includes('xml') ||
    mime.includes('csv')
  ) {
    try {
      return buf.toString('utf8').slice(0, maxChars).toLowerCase()
    } catch {
      return null
    }
  }
  return null
}

export function textContainsKeywordHaystack(haystack: string | null, needleRaw: string): boolean {
  if (!haystack) return false
  const needle = normalizeRuleVal(needleRaw)
  if (!needle || needle.length < 2) return false
  return haystack.includes(needle)
}

export function matchTipoDocumentoRuleGeminiTipo(
  ocrTipoRaw: string | null | undefined,
  ruleValRaw: string,
): boolean {
  const ruleVal = normalizeRuleVal(ruleValRaw)
  if (!ruleVal) return false
  const raw = (ocrTipoRaw ?? '').trim().toLowerCase()
  if (raw === ruleVal || raw.includes(ruleVal) || ruleVal.includes(raw)) return true
  const n = normalizeTipoDocumento(ocrTipoRaw) satisfies NormalizedTipoDocumento | null
  if (n && n === ruleVal) return true
  return !!n && String(n).includes(ruleVal)
}

/** Prima di OCR Gemini: primo match mittente → dominio → parola chiave nel testo estratto dal file. */
export async function evaluatePreGeminiDiscardRule(params: {
  rules: OcrScartoRuleRow[]
  mittenteHeader: string
  attachmentBuf: Buffer
  attachmentContentType: string | undefined
}): Promise<OcrScartoRuleRow | null> {
  const { rules, mittenteHeader, attachmentBuf, attachmentContentType } = params
  for (const r of rules) {
    const tipo = parseOcrScartoRuleTipo(r.tipo)
    if (!tipo || tipo === 'tipo_documento') continue
    if (tipo === 'mittente') {
      if (matchMittenteRule(mittenteHeader, r.valore)) return r
      continue
    }
    if (tipo === 'dominio') {
      if (matchDominioRule(mittenteHeader, r.valore)) return r
      continue
    }
    if (tipo === 'parola_chiave') {
      const blob = await attachmentPlainTextSnippetForKeywords(
        attachmentBuf,
        attachmentContentType,
        120_000,
      )
      if (textContainsKeywordHaystack(blob, r.valore)) return r
    }
  }
  return null
}

/** Dopo OCR: solo tipo_documento sul valore Gemini. */
export function evaluatePostGeminiDiscardRuleTipo(
  rules: OcrScartoRuleRow[],
  ocrTipoRaw: string | null | undefined,
): OcrScartoRuleRow | null {
  for (const r of rules) {
    if (parseOcrScartoRuleTipo(r.tipo) !== 'tipo_documento') continue
    if (matchTipoDocumentoRuleGeminiTipo(ocrTipoRaw, r.valore)) return r
  }
  return null
}

export function mergeScartoRegolaMetadata(
  baseMeta: Record<string, unknown>,
  rule: Pick<OcrScartoRuleRow, 'tipo' | 'valore'> & { motivo?: string | null },
): Record<string, unknown> {
  return {
    ...baseMeta,
    scartato_da_regola: {
      tipo: rule.tipo,
      valore: typeof rule.valore === 'string' ? rule.valore.trim() : rule.valore,
      ...(rule.motivo?.trim() ? { motivo: rule.motivo.trim() } : {}),
    },
  }
}

'use client'

import type {
  DuplicateFatturaReportGroup,
  DuplicateFatturaReportRow,
  DuplicateFatturaScanProgressItem,
} from '@/lib/duplicate-fatture-report'

export type { DuplicateFatturaReportGroup, DuplicateFatturaReportRow, DuplicateFatturaScanProgressItem }

export type ApiOk = {
  ok: true
  groups: DuplicateFatturaReportGroup[]
  scannedRows: number
  truncated: boolean
}

export type DupModalOcrPreview = {
  current: { data: string; importo: number | null; numero_fattura: string | null }
  read: {
    data: string | null
    importo: number | null
    numero_fattura: string | null
    ragione_sociale: string | null
    tipo_documento: string | null
    importo_raw: string | null
  }
  diff: { data: boolean; importo: boolean; numero_fattura: boolean }
  hasChanges: boolean
}

export function patchFatturaRowInDuplicateData(
  prev: ApiOk | null,
  fatturaId: string,
  patch: { data?: string; importo?: number | null; numero_fattura?: string | null },
): ApiOk | null {
  if (!prev) return prev
  return {
    ...prev,
    groups: prev.groups.map((g) => ({
      ...g,
      fatture: g.fatture.map((row) => (row.id === fatturaId ? { ...row, ...patch } : row)),
    })),
  }
}

export function fatturaIdsWithAttachments(groups: DuplicateFatturaReportGroup[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const g of groups) {
    for (const f of g.fatture) {
      if (!f.file_url?.trim()) continue
      if (seen.has(f.id)) continue
      seen.add(f.id)
      out.push(f.id)
    }
  }
  return out
}

export async function fetchDupModalOcrPreviewFromApi(
  fatturaId: string,
  errorFallback: string,
): Promise<DupModalOcrPreview> {
  const res = await fetch('/api/fatture/ocr-sync-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ fattura_id: fatturaId, phase: 'preview' }),
  })
  const j = (await res.json()) as {
    error?: string
    current?: DupModalOcrPreview['current']
    read?: DupModalOcrPreview['read']
    diff?: DupModalOcrPreview['diff']
    hasChanges?: boolean
  }
  if (!res.ok) throw new Error(j.error ?? errorFallback)
  if (!j.current || !j.read || !j.diff) throw new Error(errorFallback)
  return {
    current: j.current,
    read: j.read,
    diff: j.diff,
    hasChanges: Boolean(j.hasChanges),
  }
}

function compactSupplierKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '')
}

export function duplicateModalSupplierNameLikelyMismatch(
  archivedNome: string | null | undefined,
  ocrRagioneSociale: string | null | undefined,
): boolean {
  const a = archivedNome?.trim()
  const p = ocrRagioneSociale?.trim()
  if (!a || !p || p.length < 5) return false
  const ca = compactSupplierKey(a)
  const cp = compactSupplierKey(p)
  if (!ca || !cp || ca === cp) return false
  if (ca.includes(cp) || cp.includes(ca)) return false
  const longTokens = (raw: string) =>
    raw
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 5)
  for (const t of longTokens(p)) {
    if (ca.includes(compactSupplierKey(t))) return false
  }
  for (const t of longTokens(a)) {
    if (cp.includes(compactSupplierKey(t))) return false
  }
  return true
}

function parseDuplicateReportNdjsonLine(
  trimmed: string,
  onProgress: (p: { scannedSoFar: number; sample: DuplicateFatturaScanProgressItem[] }) => void,
): ApiOk | null {
  let msg: Record<string, unknown>
  try {
    msg = JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return null
  }
  if (msg.type === 'progress') {
    onProgress({
      scannedSoFar: Number(msg.scannedSoFar) || 0,
      sample: Array.isArray(msg.sample) ? (msg.sample as DuplicateFatturaScanProgressItem[]) : [],
    })
    return null
  }
  if (msg.type === 'done' && msg.ok === true) {
    return {
      ok: true,
      groups: msg.groups as DuplicateFatturaReportGroup[],
      scannedRows: Number(msg.scannedRows) || 0,
      truncated: Boolean(msg.truncated),
    }
  }
  if (msg.type === 'error') {
    throw new Error(String(msg.error ?? 'Errore'))
  }
  return null
}

export async function readDuplicateReportNdjsonStream(
  response: Response,
  signal: AbortSignal,
  onProgress: (p: { scannedSoFar: number; sample: DuplicateFatturaScanProgressItem[] }) => void,
): Promise<ApiOk> {
  if (!response.body) throw new Error('Nessun corpo risposta')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (signal.aborted) {
      await reader.cancel().catch(() => {})
      throw new DOMException('Aborted', 'AbortError')
    }
    if (value) {
      buffer += decoder.decode(value, { stream: true })
    }
    if (done) {
      buffer += decoder.decode()
    }

    const parts = buffer.split('\n')
    if (done) {
      for (const line of parts) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const result = parseDuplicateReportNdjsonLine(trimmed, onProgress)
        if (result) return result
      }
      break
    }

    buffer = parts.pop() ?? ''
    for (let i = 0; i < parts.length; i++) {
      const trimmed = parts[i]!.trim()
      if (!trimmed) continue
      const result = parseDuplicateReportNdjsonLine(trimmed, onProgress)
      if (result) return result
    }
  }
  throw new Error('Flusso interrotto prima del risultato')
}

export function resolveGroupSedeId(g: DuplicateFatturaReportGroup): string | null {
  if (g.sede_id?.trim()) return g.sede_id.trim()
  const row = g.fatture.find((f) => f.sede_id?.trim())
  return row?.sede_id?.trim() ?? null
}

'use client'

import { useState, useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/lib/toast-context'
import type { AllDuplicatesReport, DuplicateGroup } from '@/lib/duplicate-detector'
import DocumentPreviewModal from './document-preview-modal'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'

type Entity = 'fatture' | 'bolle' | 'fornitori'

type PreviewTarget = { id: string; entity: Entity } | null

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; report: AllDuplicatesReport }

// ─── helpers ─────────────────────────────────────────────────────────────────

function entityLabel(e: Entity): string {
  return e === 'fatture' ? 'Fatture' : e === 'bolle' ? 'Bolle' : 'Fornitori'
}

function entityAccent(e: Entity): string {
  return e === 'fatture'
    ? 'text-emerald-300'
    : e === 'bolle'
      ? 'text-amber-300'
      : 'text-violet-300'
}

// ─── Group section ────────────────────────────────────────────────────────────

function GroupSection({
  group,
  selected,
  onToggle,
  onPreview,
}: {
  group: DuplicateGroup
  selected: Set<string>
  onToggle: (id: string) => void
  onPreview: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)

  const allSelectedInGroup = group.items.every((i) => selected.has(i.id))
  const someSelectedInGroup = group.items.some((i) => selected.has(i.id))

  return (
    <div className="rounded-xl border border-white/10 app-workspace-inset-bg-soft">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full touch-manipulation items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-app-fg">{group.reason}</p>
          <p className="mt-0.5 text-[11px] text-app-fg-muted">{group.items.length} elementi</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {someSelectedInGroup && !allSelectedInGroup && (
            <span className="rounded-md bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
              {group.items.filter((i) => selected.has(i.id)).length} da eliminare
            </span>
          )}
          {allSelectedInGroup && (
            <span className="rounded-md bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
              tutti selezionati
            </span>
          )}
          <svg
            className={`h-4 w-4 shrink-0 text-app-fg-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <ul className="border-t border-white/8 divide-y divide-white/5">
          {group.items.map((item) => {
            const isSelected = selected.has(item.id)
            return (
              <li key={item.id} className="flex items-start gap-2 px-4 py-2.5 transition-colors hover:bg-white/5">
                <label className="flex min-w-0 flex-1 cursor-pointer touch-manipulation items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(item.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded accent-red-500"
                  />
                  <span className={`min-w-0 flex-1 break-words text-[12px] leading-snug ${isSelected ? 'text-red-200' : 'text-app-fg-muted'}`}>
                    {item.label}
                    <span className="ml-2 font-mono text-[10px] text-app-fg-muted opacity-60">
                      #{item.id.slice(0, 8)}
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => onPreview(item.id)}
                  className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md border border-sky-400/25 bg-sky-400/[0.08] px-2.5 py-[3px] text-[11px] font-semibold text-sky-400 transition-colors hover:bg-sky-400/[0.14]"
                  aria-label={`Visualizza documento ${item.id.slice(0, 8)}`}
                >
                  <svg className={`h-3 w-3 shrink-0 ${icon.duplicateAlert}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Visualizza
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─── Entity panel ─────────────────────────────────────────────────────────────

function EntityPanel({
  entity,
  groups,
  selected,
  onToggle,
  onSelectMostRecent,
  onDeselectAll,
  onPreview,
}: {
  entity: Entity
  groups: DuplicateGroup[]
  selected: Set<string>
  onToggle: (id: string) => void
  onSelectMostRecent: (entity: Entity) => void
  onDeselectAll: (entity: Entity) => void
  onPreview: (id: string, entity: Entity) => void
}) {
  const [open, setOpen] = useState(true)
  const accentCls = entityAccent(entity)
  const totalItems = groups.reduce((s, g) => s + g.items.length, 0)
  const selectedCount = groups.reduce((s, g) => s + g.items.filter((i) => selected.has(i.id)).length, 0)

  if (groups.length === 0) return null

  return (
    <div className="rounded-xl border border-white/10 app-workspace-inset-bg-soft backdrop-blur-md [-webkit-backdrop-filter:blur(12px)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full touch-manipulation items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/4"
        aria-expanded={open}
      >
        <span className={`text-sm font-bold ${accentCls}`}>{entityLabel(entity)}</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-app-fg-muted">
          {groups.length} gruppi · {totalItems} elementi
        </span>
        {selectedCount > 0 && (
          <span className="ml-auto rounded-md bg-red-500/20 px-2 py-0.5 text-[11px] font-bold text-red-300">
            {selectedCount} da eliminare
          </span>
        )}
        <svg
          className={`ml-auto h-4 w-4 shrink-0 text-app-fg-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-white/10 p-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectMostRecent(entity)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-app-line-30 app-workspace-inset-bg-soft px-3 py-1.5 text-xs font-semibold text-app-fg-muted transition-colors hover:border-app-line-45 hover:text-app-fg"
            >
              <svg className={`h-3.5 w-3.5 shrink-0 ${icon.analytics}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Seleziona più recente
            </button>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={() => onDeselectAll(entity)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-app-line-30 app-workspace-inset-bg-soft px-3 py-1.5 text-xs font-semibold text-app-fg-muted transition-colors hover:border-app-line-45 hover:text-app-fg"
              >
                Deseleziona tutti
              </button>
            )}
          </div>
          <div className="space-y-2">
            {groups.map((g, i) => (
              <GroupSection
                key={i}
                group={g}
                selected={selected}
                onToggle={onToggle}
                onPreview={(id) => onPreview(id, entity)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Confirmation modal ───────────────────────────────────────────────────────

function ConfirmModal({
  count,
  onConfirm,
  onCancel,
  deleting,
}: {
  count: number
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  const titleId = useId()

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-[290] flex items-center justify-center p-4 app-aurora-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && !deleting && onCancel()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-red-500/25 app-workspace-surface-elevated p-6 shadow-[0_0_40px_-10px_rgba(239,68,68,0.4)]">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
          <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 id={titleId} className="mb-2 text-base font-bold text-app-fg">
          Conferma eliminazione
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-app-fg-muted">
          Stai per eliminare <span className="font-semibold text-red-300">{count} {count === 1 ? 'elemento duplicato' : 'elementi duplicati'}</span>. Questa azione è irreversibile.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="inline-flex w-full items-center justify-center rounded-xl border border-app-line-30 app-workspace-inset-bg-soft px-4 py-2.5 text-sm font-semibold text-app-fg-muted transition-colors hover:border-app-line-45 hover:text-app-fg disabled:opacity-50 sm:w-auto"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_16px_-4px_rgba(239,68,68,0.5)] transition-colors hover:bg-red-700 active:bg-red-800 disabled:opacity-60 sm:w-auto"
          >
            {deleting && (
              <svg className={`h-4 w-4 animate-spin ${icon.destructive}`} fill="none" viewBox="0 0 24 24" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            Elimina definitivamente
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Main DuplicateManager ────────────────────────────────────────────────────

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** If provided, fires after a successful deletion so parent can update its badge. */
  onDeleted?: () => void
}

export default function DuplicateManager({ open, onOpenChange, onDeleted }: Props) {
  const { showToast } = useToast()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>(null)

  useEffect(() => { setMounted(true) }, [])

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Keyboard close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewTarget) {
          setPreviewTarget(null)
        } else if (!showConfirm) {
          onOpenChange(false)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onOpenChange, showConfirm, previewTarget])

  const runScan = useCallback(async () => {
    setFetchState({ status: 'loading' })
    setSelected(new Set())
    try {
      const res = await fetch('/api/duplicates/detect', { cache: 'no-store' })
      const json = (await res.json()) as { ok?: boolean; report?: AllDuplicatesReport; error?: string }
      if (!res.ok || !json.ok || !json.report) {
        throw new Error(json.error ?? 'Errore durante la scansione')
      }
      setFetchState({ status: 'done', report: json.report })
    } catch (err) {
      setFetchState({ status: 'error', message: err instanceof Error ? err.message : 'Errore sconosciuto' })
    }
  }, [])

  // Auto-scan when opened for the first time
  useEffect(() => {
    if (open && fetchState.status === 'idle') {
      void runScan()
    }
  }, [open, fetchState.status, runScan])

  const handleToggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectMostRecent = useCallback(
    (entity: Entity) => {
      if (fetchState.status !== 'done') return
      const groups = fetchState.report[entity].groups
      setSelected((prev) => {
        const next = new Set(prev)
        for (const group of groups) {
          // Sort by created_at desc, keep the newest (index 0 after sort), mark rest for deletion
          const sorted = [...group.items].sort((a, b) => {
            const da = a.created_at || ''
            const db = b.created_at || ''
            if (da !== db) return db < da ? -1 : db > da ? 1 : 0
            return b.id.localeCompare(a.id)
          })
          // newest = sorted[0] → keep; rest → delete
          for (let i = 1; i < sorted.length; i++) {
            next.add(sorted[i]!.id)
          }
        }
        return next
      })
    },
    [fetchState],
  )

  const handleDeselectAll = useCallback(
    (entity: Entity) => {
      if (fetchState.status !== 'done') return
      const allIds = new Set(fetchState.report[entity].groups.flatMap((g) => g.items.map((i) => i.id)))
      setSelected((prev) => {
        const next = new Set(prev)
        for (const id of allIds) next.delete(id)
        return next
      })
    },
    [fetchState],
  )

  const handlePreview = useCallback((id: string, entity: Entity) => {
    setPreviewTarget({ id, entity })
  }, [])

  // Validate: must keep at least 1 per group
  const getInvalidGroups = useCallback((): string[] => {
    if (fetchState.status !== 'done') return []
    const report = fetchState.report
    const invalid: string[] = []
    for (const entity of ['fatture', 'bolle', 'fornitori'] as Entity[]) {
      for (const group of report[entity].groups) {
        const remaining = group.items.filter((i) => !selected.has(i.id))
        if (remaining.length === 0) {
          invalid.push(`${entityLabel(entity)}: "${group.reason}"`)
        }
      }
    }
    return invalid
  }, [fetchState, selected])

  const handleDeleteClick = useCallback(() => {
    const invalid = getInvalidGroups()
    if (invalid.length > 0) {
      showToast(`Devi mantenere almeno 1 elemento per gruppo: ${invalid.slice(0, 2).join(', ')}`, 'error')
      return
    }
    setShowConfirm(true)
  }, [getInvalidGroups, showToast])

  const handleConfirmDelete = useCallback(async () => {
    if (fetchState.status !== 'done') return
    setDeleting(true)
    const report = fetchState.report

    const idsPerEntity: Partial<Record<Entity, string[]>> = {}
    for (const entity of ['fatture', 'bolle', 'fornitori'] as Entity[]) {
      const entityIds = report[entity].groups
        .flatMap((g) => g.items.map((i) => i.id))
        .filter((id) => selected.has(id))
      if (entityIds.length > 0) idsPerEntity[entity] = entityIds
    }

    let totalDeleted = 0
    let hasError = false

    for (const [entity, ids] of Object.entries(idsPerEntity) as [Entity, string[]][]) {
      try {
        const res = await fetch('/api/duplicates/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, entity }),
        })
        const json = (await res.json()) as { ok?: boolean; deleted?: number; error?: string }
        if (!res.ok || !json.ok) {
          showToast(`Errore eliminazione ${entity}: ${json.error ?? 'Errore'}`, 'error')
          hasError = true
        } else {
          totalDeleted += json.deleted ?? 0
        }
      } catch {
        showToast(`Errore di rete durante eliminazione ${entity}`, 'error')
        hasError = true
      }
    }

    setDeleting(false)
    setShowConfirm(false)

    if (!hasError) {
      showToast(`${totalDeleted} ${totalDeleted === 1 ? 'elemento eliminato' : 'elementi eliminati'} con successo`, 'success')
      setSelected(new Set())
      onDeleted?.()
      await runScan()
    }
  }, [fetchState, selected, showToast, onDeleted, runScan])

  if (!mounted || !open) return null

  const report = fetchState.status === 'done' ? fetchState.report : null
  const totalGroups = report
    ? report.fatture.groups.length + report.bolle.groups.length + report.fornitori.groups.length
    : 0

  return createPortal(
    <>
      {showConfirm && (
        <ConfirmModal
          count={selected.size}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setShowConfirm(false)}
          deleting={deleting}
        />
      )}
      <DocumentPreviewModal
        open={previewTarget !== null}
        onClose={() => setPreviewTarget(null)}
        itemId={previewTarget?.id ?? null}
        entity={previewTarget?.entity ?? null}
        isSelected={previewTarget !== null && selected.has(previewTarget.id)}
        onMarkForDeletion={(id) => {
          handleToggle(id)
          setPreviewTarget(null)
        }}
      />
      <div
        className="fixed inset-0 z-[280] isolate flex items-end justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] max-md:pb-[calc(5.75rem+env(safe-area-inset-bottom,0px)+0.75rem)] app-aurora-modal-overlay sm:items-center sm:pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
      >
        <div
          ref={panelRef}
          className="app-duplicate-manager-shell flex max-h-[min(92vh,780px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-sky-400/22 shadow-[0_0_50px_-15px_rgba(249,156,0,0.28)]"
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-bold text-app-fg sm:text-lg">
                Gestione Duplicati
              </h2>
              {report && (
                <p className="mt-0.5 text-xs text-app-fg-muted">
                  {totalGroups === 0
                    ? 'Nessun duplicato trovato'
                    : `${totalGroups} ${totalGroups === 1 ? 'gruppo trovato' : 'gruppi trovati'} — ${report.fatture.total} fatture, ${report.bolle.total} bolle, ${report.fornitori.total} fornitori`}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void runScan()}
                disabled={fetchState.status === 'loading'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-app-line-30 app-workspace-inset-bg-soft px-2.5 py-1 text-[11px] font-semibold text-app-fg-muted transition-colors hover:border-app-line-45 hover:text-app-fg disabled:opacity-50"
              >
                <svg className={`h-3 w-3 ${icon.duplicateAlert} ${fetchState.status === 'loading' ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {fetchState.status === 'loading' ? 'Scansione…' : 'Riscan'}
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-app-line-30 app-workspace-inset-bg-soft px-2.5 py-1 text-[11px] font-semibold text-app-fg-muted transition-colors hover:border-app-line-45 hover:text-app-fg"
              >
                Chiudi
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
            {fetchState.status === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-16" role="status" aria-live="polite">
                <svg className="h-8 w-8 animate-spin text-amber-400/80" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <p className="text-sm text-app-fg-muted">
                  Controllo duplicati in corso (metadati e allegati su Storage)… può richiedere alcuni secondi.
                </p>
              </div>
            )}

            {fetchState.status === 'error' && (
              <div className="rounded-xl border border-red-500/25 bg-red-950/30 px-4 py-4 text-sm text-red-300">
                <p className="font-semibold">Errore durante la scansione</p>
                <p className="mt-1 text-red-300/80">{fetchState.message}</p>
              </div>
            )}

            {fetchState.status === 'done' && totalGroups === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                  <svg className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-app-fg">Nessun duplicato trovato</p>
                <p className="text-xs text-app-fg-muted">Tutti i dati sembrano univoci.</p>
              </div>
            )}

            {fetchState.status === 'done' && totalGroups > 0 && (
              <div className="space-y-4">
                {(['fatture', 'bolle', 'fornitori'] as Entity[]).map((entity) => (
                  <EntityPanel
                    key={entity}
                    entity={entity}
                    groups={report![entity].groups}
                    selected={selected}
                    onToggle={handleToggle}
                    onSelectMostRecent={handleSelectMostRecent}
                    onDeselectAll={handleDeselectAll}
                    onPreview={handlePreview}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {fetchState.status === 'done' && totalGroups > 0 && (
            <div className="app-duplicate-manager-footer relative z-[2] flex shrink-0 items-center justify-between gap-3 border-t border-red-500/25 bg-[rgb(10_17_34/0.97)] px-4 py-3 backdrop-blur-md shadow-[0_-12px_40px_-4px_rgb(0,0,0,0.55)] sm:px-5 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
              <p className="text-xs text-app-fg-muted">
                {selected.size === 0
                  ? 'Seleziona gli elementi da eliminare'
                  : `${selected.size} ${selected.size === 1 ? 'elemento selezionato' : 'elementi selezionati'}`}
              </p>
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={selected.size === 0 || deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-[0_0_16px_-6px_rgba(239,68,68,0.5)] transition-colors hover:bg-red-700 active:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className={`h-4 w-4 shrink-0 ${icon.destructive}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Elimina selezionati ({selected.size})
              </button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

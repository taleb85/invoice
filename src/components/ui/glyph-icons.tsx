'use client'

import type { ReactNode, SVGProps } from 'react'

import type { ActivityGlyphId } from '@/lib/activity-logger'

export type { ActivityGlyphId } from '@/lib/activity-logger'
export { LocaleCodeChip } from '@/components/ui/locale-code-chip'

const svgBase = 'shrink-0 fill-none stroke currentColor overflow-visible' as const

export function GlyphIcon(props: SVGProps<SVGSVGElement> & { paths: ReactNode }) {
  const { className, paths, ...rest } = props
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={[svgBase, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {paths}
    </svg>
  )
}

export function ActivityGlyph({ id, className = 'h-3 w-3' }: { id: ActivityGlyphId; className?: string }) {
  const sw = { strokeWidth: 2 as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (id) {
    case 'package':
      return (
        <GlyphIcon className={className} paths={<path {...sw} d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />} />
      )
    case 'document-text':
      return (
        <GlyphIcon
          className={className}
          paths={
            <>
              <path {...sw} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </>
          }
        />
      )
    case 'clipboard-list':
      return (
        <GlyphIcon
          className={className}
          paths={
            <>
              <path {...sw} d="M9 5H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h6m-6 4h6" />
            </>
          }
        />
      )
    case 'building-store':
      return (
        <GlyphIcon
          className={className}
          paths={<path {...sw} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />}
        />
      )
    case 'user':
      return (
        <GlyphIcon className={className} paths={<path {...sw} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />} />
      )
    case 'mail':
      return (
        <GlyphIcon className={className} paths={<path {...sw} d="M3 8l9 6 9-6M21 18H3V8" />} />
      )
    case 'currency':
      return (
        <GlyphIcon
          className={className}
          paths={<path {...sw} d="M17 9V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V9m-12 4h8m-8-4h10" />}
        />
      )
    case 'trash':
      return (
        <GlyphIcon
          className={className}
          paths={<path {...sw} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m14 0H5m4-3h6a2 2 0 012 2v1H7V6a2 2 0 012-2z" />}
        />
      )
    case 'sparkles':
      return (
        <GlyphIcon className={className} paths={<path {...sw} d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />} />
      )
    default:
      return (
        <GlyphIcon
          className={className}
          paths={<path {...sw} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m12 8a2 2 0 100-4m0 4a2 2 0 110-4" />}
        />
      )
  }
}

/** Dot + etichetta sync IMAP toolbar (OK / ritardo / ferma / errore). */
export function EmailSyncHealthMarker({
  tier,
  className = 'h-2 w-2 shrink-0',
}: {
  tier: 'ok' | 'late' | 'stopped' | 'issue'
  className?: string
}) {
  if (tier === 'issue') {
    return (
      <GlyphIcon
        className={`${className} h-3 w-3 text-amber-400`}
        paths={
          <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        }
      />
    )
  }
  const fill =
    tier === 'ok' ? 'rgb(52 211 153)' : tier === 'late' ? 'rgb(251 191 36)' : 'rgb(248 113 113)'
  return (
    <svg viewBox="0 0 8 8" aria-hidden className={[className, 'rounded-full'].filter(Boolean).join(' ')}>
      <circle cx="4" cy="4" r="4" fill={fill} />
    </svg>
  )
}

export function GlyphWarningTriangle({
  className = 'h-4 w-4 shrink-0',
}: {
  className?: string
}) {
  return (
    <GlyphIcon
      className={`${className} text-current`}
      paths={
        <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      }
    />
  )
}

export function GlyphCheck({ className = 'h-3.5 w-3.5 shrink-0' }: { className?: string }) {
  return (
    <GlyphIcon
      className={className}
      paths={<path strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />}
    />
  )
}

export function GlyphXMark({ className = 'h-3.5 w-3.5 shrink-0' }: { className?: string }) {
  return (
    <GlyphIcon className={className} paths={<path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />} />
  )
}

export function GlyphEllipsis({ className = 'h-3.5 w-3.5 shrink-0 text-current' }: { className?: string }) {
  return (
    <GlyphIcon
      className={className}
      paths={<path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01" />}
    />
  )
}

export function GlyphExclamationBold({ className = 'h-3.5 w-3.5 shrink-0 text-current' }: { className?: string }) {
  return (
    <GlyphIcon className={className} paths={<path strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" d="M12 9v5m0 3h.01" />} />
  )
}

export function GlyphForwardSkip({ className = 'h-3.5 w-3.5 shrink-0 text-current' }: { className?: string }) {
  return (
    <GlyphIcon className={className} paths={<path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M11 5l7 7-7 7M4 18V6" />} />
  )
}

export function GlyphLightBulb({ className = 'h-4 w-4 shrink-0 text-current' }: { className?: string }) {
  return (
    <GlyphIcon
      className={className}
      paths={
        <path
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18h.01M8 21h8M9.664 17h4.672M18 13a8 8 0 10-11.314 0 7.974 7.974 0 003.974 6.132L12 21l.34-1.868A8.006 8.006 0 0018 13z"
        />
      }
    />
  )
}

export function GlyphGlobe({ className = 'h-4 w-4 shrink-0 text-current' }: { className?: string }) {
  return (
    <GlyphIcon
      className={className}
      paths={
        <path
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c2.761 0 5-9 5-9s-2.239-9-5-9m9 18c2.761 0 5-9 5-9"
        />
      }
    />
  )
}

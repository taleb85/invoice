'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/use-t'
import { BTN_SIZE_XS } from '@/lib/button-size-tokens'
import { BTN_SIZE_SM } from '@/lib/button-size-tokens'
import DuplicateFattureModal from '@/components/DuplicateFattureModal'

const toolbarStripBtnCls = [
  'inline-flex items-center gap-1.5 rounded-lg border',
  'border-transparent bg-transparent px-2 py-[5px] text-xs font-bold uppercase tracking-wider',
  'text-app-fg-muted hover:bg-amber-950/40 hover:text-amber-100 hover:border-amber-500/25',
  'transition-colors',
].join(' ')

const defaultBtnCls = [
  'group relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-xl',
  'border border-amber-500/20 bg-amber-950/25 px-3 py-2',
  'text-xs font-bold uppercase tracking-wider text-amber-100/80',
  'hover:bg-amber-950/40 hover:text-amber-100 hover:border-amber-400/40',
  'transition-colors',
  BTN_SIZE_XS,
  'sm:' + BTN_SIZE_SM,
].join(' ')

export default function DashboardDuplicateFattureButton({
  className,
  alwaysShowLabel = false,
  toolbarStrip = false,
}: {
  className?: string
  alwaysShowLabel?: boolean
  toolbarStrip?: boolean
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const t = useT()

  const handleRefresh = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? (toolbarStrip ? toolbarStripBtnCls : defaultBtnCls)}
      >
        <svg
          className={`${toolbarStrip ? 'h-3 w-3 sm:h-3.5 sm:w-3.5' : 'h-4 w-4'} shrink-0 opacity-90`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
        {toolbarStrip && alwaysShowLabel ? (
          <>
            <span className="hidden md:inline">{t.dashboard.duplicateFattureScanButton}</span>
            <span className="inline md:hidden">{t.dashboard.duplicateFattureToolbarShort}</span>
          </>
        ) : (
          <span className={alwaysShowLabel ? '' : 'hidden md:inline'}>{t.dashboard.duplicateFattureScanButton}</span>
        )}
      </button>

      <DuplicateFattureModal
        open={open}
        onClose={() => setOpen(false)}
        onRefresh={handleRefresh}
      />
    </>
  )
}

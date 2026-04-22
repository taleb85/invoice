'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useLocale } from '@/lib/locale-context'
import { useMe } from '@/lib/me-context'
import { normalizeOperatorLoginName } from '@/lib/operator-login-name'
import { LOCALES } from '@/lib/translations'
import {
  branchSessionGateRequiredRole,
  isSessionOperatorGateOk,
  markSessionOperatorGateOk,
} from '@/lib/session-operator-gate'
import LoginBrandedHero from '@/components/LoginBrandedHero'
import { PinNumpad } from '@/components/PinNumpad'

type Message = { type: 'error' | 'success'; text: string }

const EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com',
  'live.it', 'live.com', 'yahoo.com', 'yahoo.it', 'icloud.com',
  'libero.it', 'virgilio.it', 'aruba.it', 'proton.me', 'protonmail.com',
]

const PIN_LENGTH = 4

type LoginFormProps = { sessionGateNext?: string }

export default function LoginForm({ sessionGateNext }: LoginFormProps) {
  return <LoginFormInner sessionGateNext={sessionGateNext} />
}

function LoginFormInner({ sessionGateNext }: LoginFormProps) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { locale, t, setLocale } = useLocale()
  const { me, loading: meLoading } = useMe()
  const [langOpen, setLangOpen] = useState(false)
  const [gateUiReady, setGateUiReady] = useState(() => !sessionGateNext)

  // Populated when the user is redirected here after a server-side session expiry.
  const expiredReason = searchParams?.get('reason') ?? null

  const [mode, setMode]     = useState<'name' | 'admin'>('name')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  /* ── operatore ─────────────────────────────────────── */
  const [name, setName]         = useState('')
  const [sedeNome, setSedeNome] = useState<string | null>(null)
  /** Ultima sede ricordata da localStorage (mostrata al ritorno dell'utente) */
  const [rememberedSede, setRememberedSede] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [nameReady, setNameReady] = useState(false) // nome trovato nel DB
  const resolvedEmail = useRef<string | null>(null)  // email interna → usata per signIn

  /* PIN: array di 4 cifre */
  const [pin, setPin]   = useState<string[]>(Array(PIN_LENGTH).fill(''))
  const pinRefs         = useRef<(HTMLInputElement | null)[]>([])
  const nameInputRef    = useRef<HTMLInputElement | null>(null)
  /** Ref callback stabile (useCallback) per evitare che il focus torni al nome ad ogni re-render */
  const nameInputRefCb  = useCallback((el: HTMLInputElement | null) => {
    nameInputRef.current = el
    if (el && !('ontouchstart' in window)) el.focus()
  }, [])

  /* ── admin ─────────────────────────────────────────── */
  const [email, setEmail]           = useState('')
  const [adminPw, setAdminPw]       = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSugg, setShowSugg]     = useState(false)

  /** Gate opzionale admin (`ADMIN_LOGIN_GATE_PIN` sul server) */
  const [adminGateEnabled, setAdminGateEnabled] = useState<boolean | null>(null)
  const [adminGateUnlocked, setAdminGateUnlocked] = useState(false)
  const [adminGatePinLen, setAdminGatePinLen]     = useState(PIN_LENGTH)
  const [adminGatePin, setAdminGatePin]           = useState<string[]>(() => Array(PIN_LENGTH).fill(''))
  const [adminGateVerifying, setAdminGateVerifying] = useState(false)
  const adminGatePinRefs = useRef<(HTMLInputElement | null)[]>([])
  const emailRef         = useRef<HTMLInputElement | null>(null)
  /** Evita toUpperCase durante composizione IME (accenti) e conflitti caret su Safari. */
  const nameComposingRef = useRef(false)
  const nameLookupDebounceRef = useRef<number | null>(null)
  /** Incrementato a ogni lookup: ignora risposte obsolete se l’utente continua a digitare. */
  const nameLookupSeqRef = useRef(0)

  useEffect(() => {
    if (sessionGateNext) setMode('name')
  }, [sessionGateNext])

  useEffect(() => {
    if (!sessionGateNext) return
    if (meLoading) return
    if (!me?.user) {
      router.replace('/login')
      return
    }
    if (!branchSessionGateRequiredRole(me.role)) {
      markSessionOperatorGateOk()
      router.replace(sessionGateNext)
      return
    }
    if (isSessionOperatorGateOk()) {
      router.replace(sessionGateNext)
      return
    }
    setGateUiReady(true)
  }, [sessionGateNext, meLoading, me?.user, me?.role, router])

  /* ─── ripristina ultima sede da localStorage ─────── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem('fluxo-last-sede-nome')
      if (stored) setRememberedSede(stored)
    } catch {
      /* storage non disponibile (es. navigazione privata) */
    }
  }, [])

  /* ─── login operatore ─────────────────────────────── */
  const doLoginByName = useCallback(async (internalEmail: string, pinStr: string) => {
    if (loading) return
    setLoading(true); setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email: internalEmail, password: pinStr })
    if (error) {
      setMessage({ type: 'error', text: t.login.pinIncorrect })
      setLoading(false)
      /* svuota e rimetti focus sul primo campo */
      setPin(Array(PIN_LENGTH).fill(''))
      setTimeout(() => pinRefs.current[0]?.focus(), 50)
      return
    }
    try {
      localStorage.removeItem('fluxo-active-operator')
      localStorage.removeItem('fluxo-active-operator-user')
      /* salva ultima sede per pre-popolare il logo al prossimo accesso */
      if (sedeNome) localStorage.setItem('fluxo-last-sede-nome', sedeNome)
    } catch {
      /* ignore */
    }
    markSessionOperatorGateOk()
    if (sessionGateNext) {
      router.replace(sessionGateNext)
    } else {
      router.push('/')
    }
    router.refresh()
  }, [loading, sedeNome, sessionGateNext, supabase, router, t.login.pinIncorrect])

  /* ─── lookup nome → email interna ─────────────────── */
  const lookupSede = useCallback(async (n: string, opts?: { silentNotFound?: boolean }) => {
    const token = normalizeOperatorLoginName(n)
    if (!token) {
      setLookingUp(false)
      setSedeNome(null)
      setNameReady(false)
      resolvedEmail.current = null
      return
    }
    const seq = ++nameLookupSeqRef.current
    setLookingUp(true)
    const ac = new AbortController()
    const abortTimer = window.setTimeout(() => ac.abort(), 18_000)
    try {
      const res = await fetch('/api/lookup-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: token }),
        signal: ac.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (seq !== nameLookupSeqRef.current) return
      if (res.ok) {
        if (sessionGateNext) {
          const isAdmin = String(me?.role ?? '').toLowerCase() === 'admin'
          if (!isAdmin) {
            const emailNorm = String(data.email ?? '')
              .trim()
              .toLowerCase()
            const sessionEmail = String(me?.user?.email ?? '')
              .trim()
              .toLowerCase()
            if (emailNorm && sessionEmail && emailNorm !== sessionEmail) {
              setSedeNome(null)
              setNameReady(false)
              resolvedEmail.current = null
              setMessage({ type: 'error', text: t.login.sessionGateWrongUser })
              return
            }
          }
        }
        setSedeNome(data.sede_nome ?? null)
        resolvedEmail.current = data.email ?? null
        setNameReady(true)
        if (pin.join('').length === PIN_LENGTH && data.email) {
          doLoginByName(data.email, pin.join(''))
        }
      } else {
        setSedeNome(null)
        setNameReady(false)
        resolvedEmail.current = null
        if (!opts?.silentNotFound) {
          setMessage({ type: 'error', text: t.login.notFound })
        }
      }
    } catch (err) {
      if (seq !== nameLookupSeqRef.current) return
      if (err instanceof Error && err.name === 'AbortError') return
      setSedeNome(null)
      setNameReady(false)
      resolvedEmail.current = null
      if (!opts?.silentNotFound) {
        setMessage({ type: 'error', text: t.ui.networkError })
      }
    } finally {
      window.clearTimeout(abortTimer)
      if (seq === nameLookupSeqRef.current) {
        setLookingUp(false)
      }
    }
  }, [
    doLoginByName,
    me?.user?.email,
    me?.role,
    pin,
    sessionGateNext,
    t.login.notFound,
    t.login.sessionGateWrongUser,
    t.ui.networkError,
  ])

  const scheduleDebouncedNameLookup = useCallback((rawSnapshot: string) => {
    if (nameLookupDebounceRef.current) {
      clearTimeout(nameLookupDebounceRef.current)
      nameLookupDebounceRef.current = null
    }
    const token = normalizeOperatorLoginName(rawSnapshot)
    if (token.length < 2) {
      nameLookupSeqRef.current += 1
      setLookingUp(false)
      setSedeNome(null)
      setNameReady(false)
      resolvedEmail.current = null
      return
    }
    nameLookupDebounceRef.current = window.setTimeout(() => {
      nameLookupDebounceRef.current = null
      void lookupSede(token, { silentNotFound: true })
    }, 400)
  }, [lookupSede])

  useEffect(() => {
    return () => {
      if (nameLookupDebounceRef.current) {
        clearTimeout(nameLookupDebounceRef.current)
        nameLookupDebounceRef.current = null
      }
    }
  }, [])

  /* ─── gestione digitazione PIN ────────────────────── */
  const handlePinChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1) // solo ultima cifra
    const next  = [...pin]
    next[idx]   = digit
    setPin(next)
    setMessage(null)

    if (digit) {
      if (idx < PIN_LENGTH - 1) {
        pinRefs.current[idx + 1]?.focus()
      } else {
        /* ultimo box compilato */
        pinRefs.current[idx]?.blur()
        const full = next.join('')
        if (full.length === PIN_LENGTH && resolvedEmail.current) {
          doLoginByName(resolvedEmail.current, full)
        }
      }
    }
  }

  const handlePinKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    /* Digit 0-9: gestisci direttamente per garantire funzionamento anche con inputMode="none" */
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      const digit = e.key
      const next  = [...pin]
      next[idx]   = digit
      setPin(next)
      setMessage(null)
      if (idx < PIN_LENGTH - 1) {
        pinRefs.current[idx + 1]?.focus()
      } else {
        pinRefs.current[idx]?.blur()
        const full = next.join('')
        if (full.length === PIN_LENGTH && resolvedEmail.current) {
          doLoginByName(resolvedEmail.current, full)
        }
      }
      return
    }
    if (e.key === 'Backspace') {
      if (pin[idx]) {
        const next = [...pin]; next[idx] = ''; setPin(next)
      } else if (idx > 0) {
        pinRefs.current[idx - 1]?.focus()
        const next = [...pin]; next[idx - 1] = ''; setPin(next)
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      pinRefs.current[idx - 1]?.focus()
    } else if (e.key === 'ArrowRight' && idx < PIN_LENGTH - 1) {
      pinRefs.current[idx + 1]?.focus()
    }
  }

  /* Numpad helpers (used by PinNumpad on /accesso) */
  const pressNumpadDigit = useCallback((d: string) => {
    setPin(prev => {
      const filled = prev.filter(x => x !== '').length
      if (filled >= PIN_LENGTH) return prev
      const next = [...prev]
      next[filled] = d
      return next
    })
    setMessage(null)
  }, [])

  const numpadBackspace = useCallback(() => {
    setPin(prev => {
      const filled = prev.filter(x => x !== '').length
      if (filled === 0) return prev
      const next = [...prev]
      next[filled - 1] = ''
      return next
    })
  }, [])

  const numpadClear = useCallback(() => {
    setPin(Array(PIN_LENGTH).fill(''))
    setMessage(null)
  }, [])

  /* gestione incolla (es. "1234" → riempie tutto) */
  const handlePinPaste = (e: React.ClipboardEvent) => {
    const text   = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH)
    if (!text) return
    e.preventDefault()
    const next = Array(PIN_LENGTH).fill('')
    text.split('').forEach((c, i) => { next[i] = c })
    setPin(next)
    const lastFilled = Math.min(text.length, PIN_LENGTH) - 1
    pinRefs.current[lastFilled]?.focus()
    if (text.length === PIN_LENGTH && resolvedEmail.current) {
      doLoginByName(resolvedEmail.current, text)
    }
  }

  /* sposta focus al PIN appena il nome è risolto */
  useEffect(() => {
    if (!nameReady || !pin.every(d => d === '')) return
    /* Su mobile: chiudi solo la tastiera virtuale (l'utente usa il numpad) */
    nameInputRef.current?.blur()
    /* Su desktop: sposta il cursore al primo box PIN */
    if (!('ontouchstart' in window)) {
      const timer = window.setTimeout(() => {
        pinRefs.current[0]?.focus()
      }, 80)
      return () => window.clearTimeout(timer)
    }
  }, [nameReady, pin])

  /* auto-submit quando il PIN viene completato via numpad */
  useEffect(() => {
    const full = pin.join('')
    if (full.length === PIN_LENGTH && nameReady && resolvedEmail.current) {
      doLoginByName(resolvedEmail.current, full)
    }
  }, [pin, nameReady]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Gate admin: stato da server */
  useEffect(() => {
    if (mode !== 'admin') return
    setAdminGateEnabled(null)
    setAdminGateUnlocked(false)
    setMessage(null)
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin-login-gate')
        const data = (await res.json().catch(() => ({}))) as {
          enabled?: boolean
          pinLength?: number
        }
        if (cancelled) return
        const en = Boolean(data.enabled)
        setAdminGateEnabled(en)
        if (!en) {
          setAdminGateUnlocked(true)
          return
        }
        const pl =
          typeof data.pinLength === 'number' && data.pinLength > 0
            ? data.pinLength
            : PIN_LENGTH
        setAdminGatePinLen(pl)
        setAdminGatePin(Array(pl).fill(''))
        setAdminGateUnlocked(false)
      } catch {
        if (!cancelled) {
          setAdminGateEnabled(false)
          setAdminGateUnlocked(true)
        }
      }
    })()
    return () => { cancelled = true }
  }, [mode])

  useEffect(() => {
    if (mode !== 'admin' || adminGateEnabled !== true || adminGateUnlocked || adminGateVerifying) return
    adminGatePinRefs.current[0]?.focus()
  }, [mode, adminGateEnabled, adminGateUnlocked, adminGateVerifying])

  useEffect(() => {
    if (mode !== 'admin' || !adminGateUnlocked) return
    const tmr = window.setTimeout(() => emailRef.current?.focus(), 60)
    return () => window.clearTimeout(tmr)
  }, [mode, adminGateUnlocked])

  const verifyAdminGate = useCallback(
    async (full: string) => {
      if (adminGateVerifying) return
      setAdminGateVerifying(true)
      setMessage(null)
      try {
        const res = await fetch('/api/admin-login-gate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: full }),
        })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean }
        if (res.ok && data.ok) {
          setAdminGateUnlocked(true)
          setAdminGatePin(Array(adminGatePinLen).fill(''))
        } else {
          setMessage({ type: 'error', text: t.login.adminGateWrong })
          setAdminGatePin(Array(adminGatePinLen).fill(''))
          window.setTimeout(() => adminGatePinRefs.current[0]?.focus(), 50)
        }
      } catch {
        setMessage({ type: 'error', text: t.ui.networkError })
      } finally {
        setAdminGateVerifying(false)
      }
    },
    [adminGatePinLen, adminGateVerifying, t.login.adminGateWrong, t.ui.networkError],
  )

  const handleAdminGatePinChange = (idx: number, val: string) => {
    const char = val.length === 0 ? '' : val.slice(-1)
    const next = [...adminGatePin]
    next[idx]  = char
    setAdminGatePin(next)
    setMessage(null)

    if (char) {
      if (idx < adminGatePinLen - 1) {
        adminGatePinRefs.current[idx + 1]?.focus()
      } else {
        adminGatePinRefs.current[idx]?.blur()
        const full = next.join('')
        if (full.length === adminGatePinLen) void verifyAdminGate(full)
      }
    }
  }

  const handleAdminGatePinKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (adminGatePin[idx]) {
        const next = [...adminGatePin]; next[idx] = ''; setAdminGatePin(next)
      } else if (idx > 0) {
        adminGatePinRefs.current[idx - 1]?.focus()
        const next = [...adminGatePin]; next[idx - 1] = ''; setAdminGatePin(next)
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      adminGatePinRefs.current[idx - 1]?.focus()
    } else if (e.key === 'ArrowRight' && idx < adminGatePinLen - 1) {
      adminGatePinRefs.current[idx + 1]?.focus()
    }
  }

  const handleAdminGatePinPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').slice(0, adminGatePinLen)
    if (!text) return
    e.preventDefault()
    const next = Array(adminGatePinLen).fill('')
    text.split('').forEach((c, i) => { next[i] = c })
    setAdminGatePin(next)
    const lastFilled = Math.min(text.length, adminGatePinLen) - 1
    adminGatePinRefs.current[Math.max(0, lastFilled)]?.focus()
    if (text.length === adminGatePinLen) void verifyAdminGate(text)
  }

  /* ─── email autocomplete ──────────────────────────── */
  const handleEmailChange = (val: string) => {
    setEmail(val)
    const at = val.indexOf('@')
    if (at !== -1) {
      const local = val.slice(0, at), after = val.slice(at + 1).toLowerCase()
      const hits  = EMAIL_DOMAINS.filter(d => d.startsWith(after) && d !== after).map(d => `${local}@${d}`)
      setSuggestions(hits.slice(0, 5)); setShowSugg(hits.length > 0)
    } else { setSuggestions([]); setShowSugg(false) }
  }

  /* ─── login admin (solo profilo role = admin) ─────── */
  const handleLoginByEmail = async () => {
    if (!adminGateUnlocked || !email || !adminPw) return
    setLoading(true); setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: adminPw })
    if (error) { setMessage({ type: 'error', text: t.login.invalidCredentials }); setLoading(false); return }

    const { data: { user: signedUser } } = await supabase.auth.getUser()
    if (!signedUser) {
      setMessage({ type: 'error', text: t.login.invalidCredentials })
      setLoading(false)
      return
    }
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', signedUser.id).maybeSingle()
    if (String(prof?.role ?? '').toLowerCase() !== 'admin') {
      await supabase.auth.signOut()
      setMessage({ type: 'error', text: t.login.adminOnlyEmail })
      setLoading(false)
      return
    }

    // Stesso URL `/`, ma senza questo la UI resta “come operatore”: cookie sede + operatore in localStorage
    // da sessioni precedenti sul browser (es. Osteria Basilico + Gustavo).
    document.cookie = 'admin-sede-id=; path=/; Max-Age=0; SameSite=Strict'
    document.cookie = 'fluxo-acting-role=; path=/; Max-Age=0; SameSite=Strict'
    try {
      localStorage.removeItem('fluxo-active-operator')
      localStorage.removeItem('fluxo-active-operator-user')
    } catch {
      /* ignore */
    }

    router.push('/'); router.refresh()
  }

  const inputCls =
    'w-full rounded-xl border border-app-line-30 app-workspace-inset-bg px-4 py-3 text-sm text-app-fg ring-1 ring-inset ring-white/5 transition placeholder:text-app-fg-muted focus:border-app-a-55 focus:outline-none focus:ring-2 focus:ring-app-a-35'

  const pinFilled = pin.join('').length === PIN_LENGTH

  if (sessionGateNext && (!gateUiReady || meLoading)) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-sm flex-col items-center justify-center gap-3 px-1">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-app-cyan-400 border-t-transparent" />
        <p className="text-sm text-app-fg-muted">{t.common.loading}</p>
      </div>
    )
  }

  return (
    <div className="w-full">

      {expiredReason && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[rgba(34,211,238,0.15)] bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
          <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span>{decodeURIComponent(expiredReason)}</span>
        </div>
      )}

      <LoginBrandedHero
        mode={mode}
        sedeNome={sedeNome ?? rememberedSede}
        remembered={!sedeNome && !!rememberedSede}
      />

      {/* Card: bordo leggero su canvas gradient (`LoginBrandedShell`); vetro pieno disattivato */}
      <div className="app-card-login app-card-login-transparent flex flex-col overflow-hidden">
        <div className="app-card-bar" aria-hidden />

        <div className="space-y-4 p-5 text-center text-app-fg sm:p-6">

        {mode === 'name' ? (
          /* ── OPERATORE: Nome + PIN a 4 cifre — niente autofill / salvataggio credenziali browser ── */
          <form
            className="space-y-5 text-center"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore
            data-bwignore
            onSubmit={e => { e.preventDefault() }}
          >

            {/* Nome */}
            <div className="text-center">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.login.nameLabel}</label>
              <input
                type="text"
                name="fluxo-branch-display"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={t.login.namePlaceholder}
                value={name}
                onCompositionStart={() => {
                  nameComposingRef.current = true
                }}
                onCompositionEnd={e => {
                  nameComposingRef.current = false
                  const v = e.currentTarget.value.toUpperCase()
                  setName(v)
                  setSedeNome(null)
                  setNameReady(false)
                  resolvedEmail.current = null
                  scheduleDebouncedNameLookup(v)
                }}
                onChange={e => {
                  const raw = e.target.value
                  const next =
                    nameComposingRef.current ? raw : raw.toUpperCase()
                  if (nameComposingRef.current) {
                    setName(raw)
                  } else {
                    setName(raw.toUpperCase())
                  }
                  setSedeNome(null)
                  setNameReady(false)
                  resolvedEmail.current = null
                  scheduleDebouncedNameLookup(next)
                }}
                onBlur={e => {
                  nameComposingRef.current = false
                  if (nameLookupDebounceRef.current) {
                    clearTimeout(nameLookupDebounceRef.current)
                    nameLookupDebounceRef.current = null
                  }
                  const token = normalizeOperatorLoginName(e.currentTarget.value)
                  setName(token)
                  void lookupSede(token, { silentNotFound: false })
                }}
                className={`${inputCls} text-center`}
                ref={nameInputRefCb}
                disabled={loading}
              />
              {/* Badge sede */}
              <div className="mt-2 flex h-6 min-h-6 items-center justify-center">
                {lookingUp && (
                  <span className="text-xs text-app-fg-muted flex items-center gap-1.5">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    {t.login.lookingUp}
                  </span>
                )}
                {!lookingUp && sedeNome && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-app-line-10 text-app-fg-muted text-xs font-semibold rounded-lg border border-app-soft-border">
                    <svg className="w-3 h-3 text-app-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                    </svg>
                    {sedeNome}
                  </span>
                )}
                {!lookingUp && !sedeNome && name.trim().length > 1 && !nameReady && (
                  <span className="text-xs text-app-fg-muted">{t.login.enterFirstName}</span>
                )}
              </div>
            </div>

            {/* PIN a 4 caselle */}
            <div className="text-center">
              <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-app-fg-muted">
                <span>{t.login.pinLabel}</span>
                <span className="font-normal normal-case text-app-fg-muted"> {t.login.pinDigits}</span>
              </label>
              <div
                className="flex justify-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/40 px-2 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:gap-3 sm:px-3 sm:py-3"
                onPaste={handlePinPaste}
              >
                {Array.from({ length: PIN_LENGTH }).map((_, idx) => (
                  <input
                    key={idx}
                    ref={el => { pinRefs.current[idx] = el }}
                    type="password"
                    name={`fluxo-access-segment-${idx}`}
                    autoComplete="off"
                    inputMode="none"
                    maxLength={2}
                    value={pin[idx]}
                    onChange={e => handlePinChange(idx, e.target.value)}
                    onKeyDown={e => handlePinKeyDown(idx, e)}
                    disabled={loading || (!nameReady && idx === 0 ? false : !nameReady)}
                    className={[
                      'h-12 w-12 rounded-xl border-2 text-center text-lg font-bold transition-all sm:h-14 sm:w-14 sm:text-xl',
                      'focus:outline-none focus:ring-2 focus:ring-cyan-500/30',
                      loading
                        ? 'border-slate-700 bg-slate-800/50 text-app-fg-muted'
                        : pin[idx]
                          ? 'border-cyan-500/70 bg-slate-800/60 text-app-fg shadow-sm shadow-cyan-500/10'
                          : nameReady
                            ? 'border-slate-600 bg-slate-800/50 text-app-fg hover:border-slate-500 focus:border-cyan-500'
                            : 'border-slate-700/60 bg-slate-800/40 text-app-fg-muted cursor-not-allowed',
                    ].join(' ')}
                  />
                ))}
              </div>

              {/* Progress dots */}
              <div className="mt-3 flex justify-center gap-2">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                    <span key={i} className={[
                    'w-1.5 h-1.5 rounded-full transition-all duration-200',
                    pin[i] ? 'bg-app-cyan-400 scale-110 shadow-[0_0_6px_rgba(34,211,238,0.6)]' : 'bg-cyan-950/55',
                  ].join(' ')} />
                ))}
              </div>

              {/* Numpad — solo mobile (sempre, sia su /login che su /accesso) */}
              <div className="mt-4 md:hidden">
                {loading ? (
                  <div className="flex justify-center py-6">
                    <svg className="w-8 h-8 text-app-cyan-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  </div>
                ) : (
                  <PinNumpad
                    onDigit={pressNumpadDigit}
                    onBackspace={numpadBackspace}
                    onClear={numpadClear}
                    disabled={loading || !nameReady}
                  />
                )}
              </div>

              {/* Indicatore auto-login */}
              {(pinFilled || loading) && (
                <p className="text-center text-xs text-blue-500 mt-2 flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {loading ? t.login.verifying : t.login.accessing}
                </p>
              )}
            </div>

            {message && <FeedbackMsg msg={message} />}
          </form>

        ) : (
          /* ── ADMIN: gate PIN opzionale + email/password ── */
          <form
            onSubmit={e => { e.preventDefault(); handleLoginByEmail() }}
            className="space-y-4 text-center"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore
            data-bwignore
          >
            {adminGateEnabled === null ? (
              <div className="flex justify-center py-12" role="status" aria-live="polite">
                <svg className="h-8 w-8 animate-spin text-app-cyan-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </div>
            ) : !adminGateUnlocked ? (
              <div className="space-y-4">
                <label className="block text-xs font-semibold uppercase tracking-wide text-app-fg-muted">
                  {t.login.adminGateLabel}
                </label>
                <p className="px-0.5 text-[11px] leading-relaxed text-app-fg-muted">{t.login.adminGateHint}</p>
                <div
                  className="flex flex-wrap justify-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
                  onPaste={handleAdminGatePinPaste}
                >
                  {Array.from({ length: adminGatePinLen }).map((_, idx) => {
                    const narrow = adminGatePinLen > 5
                    return (
                      <input
                        key={idx}
                        ref={el => { adminGatePinRefs.current[idx] = el }}
                        type="password"
                        name={`fluxo-admin-gate-${idx}`}
                        autoComplete="off"
                        inputMode="text"
                        maxLength={2}
                        value={adminGatePin[idx]}
                        onChange={e => handleAdminGatePinChange(idx, e.target.value)}
                        onKeyDown={e => handleAdminGatePinKeyDown(idx, e)}
                        disabled={adminGateVerifying}
                        className={[
                          narrow ? 'h-10 w-9 text-base' : 'h-14 w-14 text-xl',
                          'border-2 text-center font-bold transition-all',
                          'rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30',
                          adminGateVerifying
                            ? 'border-slate-700 bg-slate-800/50 text-app-fg-muted'
                            : adminGatePin[idx]
                              ? 'border-cyan-500/70 bg-slate-800/60 text-app-fg shadow-sm shadow-cyan-500/10'
                              : 'border-slate-600 bg-slate-800/50 text-app-fg hover:border-slate-500 focus:border-cyan-500',
                        ].join(' ')}
                      />
                    )
                  })}
                </div>
                {adminGateVerifying && (
                  <p className="mt-1 flex items-center justify-center gap-2 text-xs text-app-cyan-500">
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    {t.login.verifying}
                  </p>
                )}
                {message && <FeedbackMsg msg={message} />}
              </div>
            ) : (
              <>
                <div className="relative text-left">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.login.emailLabel}</label>
                  <input
                    ref={emailRef}
                    type="email"
                    name="fluxo-admin-email"
                    autoComplete="off"
                    placeholder={t.login.emailPlaceholder}
                    value={email}
                    onChange={e => handleEmailChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                    onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                    className={inputCls}
                  />
                  {showSugg && (
                    <ul className="absolute left-0 right-0 z-10 mt-1 overflow-hidden rounded-xl border border-app-line-28 app-workspace-surface-elevated text-sm shadow-xl">
                      {suggestions.map(s => {
                        const at = s.indexOf('@')
                        return (
                          <li key={s}>
                            <button type="button" onMouseDown={() => { setEmail(s); setSuggestions([]); setShowSugg(false) }}
                              className="flex w-full items-center gap-1 px-4 py-2.5 text-left transition-colors hover:bg-app-line-10">
                              <span className="text-app-fg-muted">{s.slice(0, at + 1)}</span>
                              <span className="font-medium text-app-fg">{s.slice(at + 1)}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div className="text-left">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.login.passwordLabel}</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      name="fluxo-admin-secret"
                      autoComplete="off"
                      placeholder={t.login.passwordPlaceholder} value={adminPw}
                      onChange={e => setAdminPw(e.target.value)} className={inputCls + ' pr-11'}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-app-fg-muted hover:text-app-fg">
                      {showPw ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {message && <FeedbackMsg msg={message} />}

                <button type="submit" disabled={loading || !email || !adminPw || !adminGateUnlocked}
                  className="app-glow-cyan flex w-full items-center justify-center gap-2 rounded-full bg-app-cyan-500 py-3 text-sm font-bold uppercase tracking-wide text-cyan-950 transition-colors hover:bg-app-cyan-400 active:bg-cyan-600 disabled:opacity-50">
                  {loading
                    ? <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    : <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
                  }
                  {t.login.loginBtn}
                </button>
              </>
            )}
          </form>
        )}
        </div>

        {/* Barra inferiore: stessa larghezza della card (link admin + lingua) */}
        <div
          className={`flex min-h-[3rem] items-center gap-3 border-t border-white/[0.08] bg-white/[0.03] px-4 py-2.5 ${
            sessionGateNext ? 'justify-center' : 'justify-between'
          }`}
        >
          {!sessionGateNext &&
            (mode === 'name' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('admin')
                  setMessage(null)
                  setName('')
                  setSedeNome(null)
                  setNameReady(false)
                  resolvedEmail.current = null
                  setPin(Array(PIN_LENGTH).fill(''))
                  setEmail('')
                  setAdminPw('')
                  setSuggestions([])
                  setShowSugg(false)
                }}
                className="min-w-0 shrink text-left text-[11px] text-app-fg-muted transition-colors hover:text-app-fg"
              >
                {t.login.adminLink}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode('name')
                  setMessage(null)
                  setEmail('')
                  setAdminPw('')
                  setSuggestions([])
                  setShowSugg(false)
                  setName('')
                  setSedeNome(null)
                  setNameReady(false)
                  resolvedEmail.current = null
                  setPin(Array(PIN_LENGTH).fill(''))
                }}
                className="min-w-0 shrink text-left text-[11px] text-app-fg-muted/80 transition-colors hover:text-app-fg"
              >
                {t.login.operatorLink}
              </button>
            ))}

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setLangOpen(o => !o)}
              className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] text-app-fg-muted transition-colors hover:bg-white/5 hover:text-app-fg"
              aria-expanded={langOpen}
              aria-haspopup="listbox"
            >
              <span className="text-base leading-none">{LOCALES.find(l => l.code === locale)?.flag}</span>
              <span className="max-w-[5.5rem] truncate text-left font-medium">
                {LOCALES.find(l => l.code === locale)?.label}
              </span>
              <svg
                className={`h-2.5 w-2.5 shrink-0 transition-transform ${langOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {langOpen && (
              <div
                className={`absolute bottom-full z-50 mb-1 w-40 overflow-hidden rounded-xl border border-app-line-25 app-workspace-surface-elevated shadow-[0_12px_32px_-8px_rgba(0,0,0,0.45),0_0_24px_-10px_rgba(34,211,238,0.12)] ring-1 ring-inset ring-white/10 backdrop-blur-xl ${
                  sessionGateNext ? 'left-1/2 right-auto -translate-x-1/2' : 'right-0'
                }`}
                role="listbox"
              >
                {LOCALES.map(l => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      setLocale(l.code)
                      setLangOpen(false)
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11px] font-medium transition-colors ${
                      locale === l.code
                        ? 'bg-app-line-18 text-app-fg'
                        : 'text-app-fg-muted hover:bg-app-line-12 hover:text-app-fg'
                    }`}
                  >
                    <span className="text-sm">{l.flag}</span>
                    <span>{l.label}</span>
                    {locale === l.code && (
                      <svg className="ml-auto h-3 w-3 shrink-0 text-app-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FeedbackMsg({ msg }: { msg: Message }) {
  return (
    <div className={`flex flex-col items-center gap-2 rounded-xl px-4 py-3 text-center text-sm ${
      msg.type === 'error' ? 'border border-[rgba(34,211,238,0.15)] bg-red-500/10 text-red-300' : 'border border-[rgba(34,211,238,0.15)] bg-green-500/10 text-green-300'
    }`}>
      {msg.type === 'error'
        ? <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        : <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      }
      <p className="max-w-none text-pretty leading-snug">{msg.text}</p>
    </div>
  )
}

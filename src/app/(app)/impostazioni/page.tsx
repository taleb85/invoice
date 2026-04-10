'use client'

import { useState, useEffect } from 'react'
import { LOCALES, CURRENCIES, TIMEZONES } from '@/lib/translations'
import { useLocale } from '@/lib/locale-context'

const CURRENCY_COOKIE = 'app-currency'
const TIMEZONE_COOKIE = 'app-timezone'

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}`
}

export default function ImpostazioniPage() {
  const { locale, t, setLocale } = useLocale()
  const [mounted, setMounted] = useState(false)
  const [currency, setCurrency] = useState('EUR')
  const [timezone, setTimezone] = useState('Europe/Rome')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setCurrency(getCookie(CURRENCY_COOKIE) || 'EUR')
    setTimezone(getCookie(TIMEZONE_COOKIE) || 'Europe/Rome')
    setMounted(true)
  }, [])

  const handleSave = () => {
    setCookie(CURRENCY_COOKIE, currency)
    setCookie(TIMEZONE_COOKIE, timezone)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    // No page reload needed — locale changes propagate reactively via context
  }

  const selectCls = 'w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3050] bg-white'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5'

  const intlLocale =
    locale === 'it' ? 'it-IT'
    : locale === 'en' ? 'en-GB'
    : locale === 'es' ? 'es-ES'
    : locale === 'fr' ? 'fr-FR'
    : 'de-DE'

  // Valutate solo lato client dopo il mount per evitare hydration mismatch:
  // server e browser possono avere locale di sistema diversi.
  const previewData = mounted
    ? new Intl.DateTimeFormat(intlLocale, { day: '2-digit', month: 'long', year: 'numeric', timeZone: timezone }).format(new Date())
    : '…'
  const previewValuta = mounted
    ? new Intl.NumberFormat(intlLocale, { style: 'currency', currency }).format(1234.56)
    : '…'

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t.impostazioni.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{t.impostazioni.subtitle}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">

        {/* Lingua */}
        <div className="p-5 flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-[18px] h-[18px] text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </div>
          <div className="flex-1">
            <label className={labelCls}>{t.impostazioni.lingua}</label>
            <select value={locale} onChange={(e) => setLocale(e.target.value as 'it' | 'en' | 'es' | 'fr' | 'de')} className={selectCls}>
              {LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Valuta */}
        <div className="p-5 flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-[18px] h-[18px] text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <label className={labelCls}>{t.impostazioni.valuta}</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectCls}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} — {c.label} ({c.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Fuso orario */}
        <div className="p-5 flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-[18px] h-[18px] text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <label className={labelCls}>{t.impostazioni.fuso}</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={selectCls}>
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Preview — renderizzato solo lato client per evitare hydration mismatch */}
        <div className="p-5 flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-[18px] h-[18px] text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.impostazioni.preview}</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {previewData}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {previewValuta}
              </div>
            </div>
          </div>
        </div>

        {/* Salva */}
        <div className="p-5 space-y-3">
          {saved && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t.impostazioni.saved}
            </div>
          )}
          <button
            onClick={handleSave}
            className="w-full py-2.5 text-sm font-semibold bg-[#1a3050] hover:bg-[#122238] text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  )
}

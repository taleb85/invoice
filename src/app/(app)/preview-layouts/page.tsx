'use client'

import { useState } from 'react'

/* ─── Mock data ──────────────────────────────────────────────────── */

const MOCK_DOCS = [
  { id: '1', color: 'green',  badge: 'Matched',         number: 'INV-AM-350', supplier: 'Amalfi Produce London', date: '12 Mar 2025', amount: '£ 310.00', actions: ['View', 'Email'] },
  { id: '2', color: 'orange', badge: 'Missing Invoice',  number: 'DDT-OB-220', supplier: 'Oral-B UK',             date: '08 Mar 2025', amount: '£  25.00', actions: ['Email'] },
  { id: '3', color: 'red',    badge: 'Amount Error',     number: 'INV-AM-348', supplier: 'Amalfi Produce London', date: '01 Mar 2025', amount: '£ 120.00', actions: ['View', 'Email'] },
  { id: '4', color: 'green',  badge: 'OK',               number: 'INV-OB-180', supplier: 'Oral-B UK',             date: '22 Feb 2025', amount: '£  80.00', actions: ['View'] },
  { id: '5', color: 'amber',  badge: 'DDT Missing',      number: 'INV-AM-312', supplier: 'Amalfi Produce London', date: '15 Feb 2025', amount: '£  95.50', actions: ['View', 'Email'] },
]

const MOCK_STATEMENTS = [
  { id: '1', ref: 'STMT-2025-03', amount: '£ 430.00', status: 'Missing Invoice', statusColor: 'orange', stmtDate: '10 Mar 2025', sysDate: '—',          stmtAmount: '£ 430.00', sysAmount: '—',        missingField: true,  checks: 1 },
  { id: '2', ref: 'STMT-2025-02', amount: '£  25.00', status: 'DDT Missing',     statusColor: 'amber',  stmtDate: '08 Mar 2025', sysDate: '08 Mar 2025', stmtAmount: '£  25.00', sysAmount: '£  25.00', missingField: true,  checks: 2 },
  { id: '3', ref: 'STMT-2025-01', amount: '£ 120.00', status: 'Matched',         statusColor: 'green',  stmtDate: '01 Mar 2025', sysDate: '01 Mar 2025', stmtAmount: '£ 120.00', sysAmount: '£ 120.00', missingField: false, checks: 3 },
]

const MOCK_CONTACTS = [
  { role: 'Administration', name: 'Marco Ferretti', email: 'admin@amalfi.co.uk',     phone: '+44 20 7946 0100' },
  { role: 'Logistics',      name: 'Sara Bianchi',   email: 'logistics@amalfi.co.uk', phone: '+44 20 7946 0101' },
  { role: 'Accounts',       name: 'James Holden',   email: 'accounts@amalfi.co.uk',  phone: '+44 20 7946 0102' },
]

const ACTIVITY_LOG = [
  { time: '09:41', icon: '📧', text: 'Email scanned from Amalfi Produce', color: 'blue' },
  { time: '09:38', icon: '✅', text: 'INV-AM-350 matched automatically',   color: 'green' },
  { time: '09:30', icon: '⚠',  text: 'DDT-OB-220 missing invoice',         color: 'orange' },
  { time: '09:15', icon: '✉',  text: 'Reminder sent to Oral-B UK',         color: 'purple' },
  { time: '08:52', icon: '📄', text: 'OCR completed: INV-AM-348',           color: 'gray' },
  { time: '08:40', icon: '🔁', text: 'Reconciliation run for March',        color: 'blue' },
]

/* ─── Helpers ────────────────────────────────────────────────────── */

const badgeCls: Record<string, string> = {
  green:  'bg-green-100 text-green-700 border border-green-200',
  orange: 'bg-orange-100 text-orange-700 border border-orange-200',
  red:    'bg-red-100 text-red-700 border border-red-200',
  amber:  'bg-amber-100 text-amber-700 border border-amber-200',
  gray:   'bg-gray-100 text-gray-500 border border-gray-200',
}
const dotCls: Record<string, string> = {
  green:  'bg-green-500',
  orange: 'bg-orange-500',
  red:    'bg-red-500',
  amber:  'bg-amber-500',
  gray:   'bg-gray-400',
}
const activityDot: Record<string, string> = {
  blue:   'bg-blue-500',
  green:  'bg-green-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
  gray:   'bg-gray-400',
}

/* ════════════════════════════════════════════════════════════════════
   FRAMES
════════════════════════════════════════════════════════════════════ */

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[375px] rounded-[2.8rem] border-[7px] border-gray-800 shadow-2xl bg-white overflow-hidden">
      <div className="bg-gray-900 text-white text-[10px] flex items-center justify-between px-6 py-1.5">
        <span className="font-medium">9:41</span>
        <span className="font-bold tracking-widest">FLUXO</span>
        <span>●●●</span>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 680 }}>
        {children}
      </div>
    </div>
  )
}

function Browser({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-300 shadow-2xl bg-white overflow-hidden">
      {/* Browser chrome */}
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white rounded-md border border-gray-200 px-3 py-1 text-xs text-gray-400 font-mono">
          localhost:3000/dashboard
        </div>
        <div className="text-gray-400 text-xs">↻</div>
      </div>
      <div className="overflow-y-auto bg-gray-50" style={{ maxHeight: 560 }}>
        {children}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   MOBILE LAYOUTS
════════════════════════════════════════════════════════════════════ */

function MLayout0() {
  const [scanning, setScanning] = useState(false)
  const handleScan = () => { setScanning(true); setTimeout(() => setScanning(false), 2000) }
  const recent = MOCK_DOCS.slice(0, 3)

  return (
    <div className="bg-gray-50 min-h-full pb-6">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white px-5 pt-5 pb-8">
        <p className="text-xs text-gray-400 mb-0.5">Mediterraneo – TEST</p>
        <h2 className="text-lg font-bold mb-4">Good morning 👋</h2>
        <div className="grid grid-cols-3 gap-2">
          {[{ label: 'Suppliers', value: '6' }, { label: 'Pending', value: '3', alert: true }, { label: 'This month', value: '£2.4k' }].map(k => (
            <div key={k.label} className={`rounded-xl p-2.5 text-center ${'alert' in k && k.alert ? 'bg-orange-500/30 border border-orange-400/40' : 'bg-white/10'}`}>
              <p className="text-xl font-bold tabular-nums">{k.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 -mt-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-3 grid grid-cols-2 gap-2">
          <button onClick={handleScan} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${scanning ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
            <svg className={`w-3.5 h-3.5 shrink-0 ${scanning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {scanning ? 'Scanning…' : 'Scan Emails'}
          </button>
          <button className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 text-xs font-bold">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Send Reminders
          </button>
          <button className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 text-gray-600 border border-gray-100 text-xs font-bold">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Delivery Notes
          </button>
          <button className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 text-gray-600 border border-gray-100 text-xs font-bold">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            Reconcile
          </button>
        </div>
      </div>

      <div className="px-3 mt-4">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex items-start gap-3">
          <svg className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <div>
            <p className="text-xs font-bold text-orange-700">3 documents need attention</p>
            <p className="text-[11px] text-orange-500 mt-0.5">2 missing invoices · 1 amount error</p>
          </div>
          <button className="ml-auto text-xs font-semibold text-orange-600 underline whitespace-nowrap">View all</button>
        </div>
      </div>

      <div className="px-3 mt-4 space-y-2">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-3">Recent Documents</p>
        {recent.map(doc => (
          <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 px-4 py-3">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls[doc.color]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-800 font-mono">{doc.number}</p>
              <p className="text-[11px] text-gray-400 truncate">{doc.supplier}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-bold text-gray-800 tabular-nums">{doc.amount}</p>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeCls[doc.color]}`}>{doc.badge}</span>
            </div>
          </div>
        ))}
        <button className="w-full text-center text-xs text-blue-500 font-semibold py-2 flex items-center justify-center gap-1">View all <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
      </div>

      <div className="px-3 mt-2">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-3">Suppliers</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['AP', 'OB', 'DF', 'ML', 'GH', 'RS'].map((ini, i) => (
            <button key={ini} className="flex-shrink-0 flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-500 text-white text-xs font-bold flex items-center justify-center shadow">{ini}</div>
              <span className="text-[9px] text-gray-400">{['Amalfi', 'Oral-B', 'DeFris', 'Milano', 'GH Ltd', 'RoSal'][i]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function MLayout1() {
  return (
    <div className="p-3 space-y-2 pb-6 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between py-2 px-1">
        <h1 className="text-base font-bold text-gray-800">Documents</h1>
        <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">{MOCK_DOCS.length} items</span>
      </div>
      {MOCK_DOCS.map(doc => (
        <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-gray-50">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${badgeCls[doc.color]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dotCls[doc.color]}`} />{doc.badge}
            </span>
            <span className="ml-auto text-[13px] font-bold text-gray-700 font-mono">{doc.number}</span>
          </div>
          <div className="px-4 py-2.5 space-y-0.5">
            <p className="text-sm font-semibold text-gray-800 truncate">{doc.supplier}</p>
            <p className="text-xs text-gray-400">{doc.date}</p>
            <p className="text-base font-bold text-gray-900 tabular-nums">{doc.amount}</p>
          </div>
          <div className="flex justify-end gap-2 px-4 pb-3">
            {doc.actions.map(a => (
              <button key={a} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${a === 'Email' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-gray-900 text-white'}`}>
                {a === 'Email'
                  ? <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>Email</>
                  : <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>View</>
                }
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function MLayout2() {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <div className="p-3 space-y-2 pb-6 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between py-2 px-1">
        <h1 className="text-base font-bold text-gray-800">Verification Status</h1>
        <span className="text-xs text-gray-400">{MOCK_STATEMENTS.length} entries</span>
      </div>
      {MOCK_STATEMENTS.map(stmt => {
        const isOpen = expanded === stmt.id
        return (
          <div key={stmt.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button className="w-full text-left px-4 py-3 flex items-center gap-3" onClick={() => setExpanded(isOpen ? null : stmt.id)}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-800 font-mono">{stmt.ref}</p>
                <p className="text-base font-bold text-gray-900 tabular-nums mt-0.5">{stmt.amount}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badgeCls[stmt.statusColor]}`}>{stmt.status}</span>
                <svg className={`w-3.5 h-3.5 text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50">
                {[{ label: 'Date', stmt: stmt.stmtDate, sys: stmt.sysDate }, { label: 'Amount', stmt: stmt.stmtAmount, sys: stmt.sysAmount }].map(row => (
                  <div key={row.label} className="grid grid-cols-3 items-center gap-2 text-xs">
                    <span className="text-gray-400 font-medium">{row.label}</span>
                    <div className="bg-white rounded-lg border border-gray-100 px-2 py-1.5 text-center">
                      <p className="text-[9px] text-gray-400 mb-0.5">Statement</p>
                      <p className="font-semibold text-gray-700">{row.stmt}</p>
                    </div>
                    <div className={`rounded-lg border px-2 py-1.5 text-center ${row.sys === '—' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                      <p className="text-[9px] text-gray-400 mb-0.5">System {row.sys === '—' && <span className="text-red-500">✗</span>}</p>
                      <p className={`font-semibold ${row.sys === '—' ? 'text-red-500' : 'text-gray-700'}`}>{row.sys}</p>
                    </div>
                  </div>
                ))}
                {stmt.missingField && <button className="w-full mt-1 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>Send Reminder</button>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MLayout3() {
  return (
    <div className="bg-gray-50 min-h-full pb-6">
      <div className="bg-gradient-to-br from-gray-900 to-gray-700 text-white px-5 pt-5 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-xl font-bold">AP</div>
          <div><h2 className="text-base font-bold">Amalfi Produce London</h2><p className="text-xs text-gray-300">admin@amalfi.co.uk</p></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{ label: 'Invoices', value: '14' }, { label: 'Pending', value: '3' }, { label: 'Total', value: '£2.4k' }].map(k => (
            <div key={k.label} className="bg-white/10 rounded-xl p-2 text-center">
              <p className="text-lg font-bold">{k.value}</p><p className="text-[10px] text-gray-300 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="px-3 py-4 space-y-2">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-3">Contacts</p>
        {MOCK_CONTACTS.map(c => (
          <div key={c.role} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
              {c.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-400">{c.role}</p>
              <p className="text-sm font-bold text-gray-800 truncate">{c.name}</p>
            </div>
            <div className="flex gap-2">
              <a href={`tel:${c.phone}`} className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></a>
              <a href={`mailto:${c.email}`} className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></a>
            </div>
          </div>
        ))}
      </div>
      <div className="px-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-3">Sections</p>
        <div className="grid grid-cols-3 gap-2">
          {['Delivery Notes', 'Invoices', 'Price List'].map(tab => (
            <button key={tab} className="bg-white border border-gray-100 rounded-xl py-3 text-xs font-semibold text-gray-600 shadow-sm">{tab}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function MLayout4() {
  const [saved, setSaved] = useState(false)
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  return (
    <div className="bg-gray-50 min-h-full">
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <h1 className="text-base font-bold text-gray-800">Settings</h1>
        <p className="text-xs text-gray-400 mt-0.5">Sede: Mediterraneo – TEST</p>
      </div>
      <div className="px-4 py-4 space-y-6 pb-28">
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Localisation</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {[
              { label: 'Language',    val: 'English (EN)',  opts: ['English (EN)', 'Italiano (IT)', 'Español (ES)', 'Français (FR)', 'Deutsch (DE)'] },
              { label: 'Currency',    val: 'GBP (£)',        opts: ['GBP (£)', 'EUR (€)', 'USD ($)', 'CHF (Fr)'] },
              { label: 'Timezone',    val: 'Europe/London',  opts: ['Europe/London', 'Europe/Rome', 'Europe/Paris'] },
              { label: 'Date Format', val: 'DD/MM/YYYY',     opts: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] },
            ].map(f => (
              <div key={f.label} className="px-4 py-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{f.label}</label>
                <select defaultValue={f.val} className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none">
                  {f.opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Utility Conversion</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {[{ label: 'Metric Conversion Factor', val: '1.02264' }, { label: 'Calorific Value (kWh/m³)', val: '10.98' }, { label: 'VAT Rate (%)', val: '20' }].map(f => (
              <div key={f.label} className="px-4 py-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{f.label}</label>
                <input type="text" defaultValue={f.val} className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-2 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <button className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">Cancel</button>
        <button onClick={handleSave} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${saved ? 'bg-green-500 text-white' : 'bg-gray-900 text-white'}`}>
          {saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   MOCK SIDEBAR — replicates the real Fluxo sidebar visually
════════════════════════════════════════════════════════════════════ */

function MockSidebar({ active }: { active: string }) {
  const [fornitoriOpen, setFornitoriOpen] = useState(true)

  const navLink = (isActive: boolean) =>
    `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap border-l-2 pl-[9px] ${
      isActive
        ? 'bg-cyan-500/15 text-white border-cyan-500'
        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border-transparent'
    }`

  const suppliers = ['Amalfi Produce London', 'Oral-B UK']

  return (
    <aside className="w-52 bg-slate-950 flex flex-col flex-shrink-0 min-h-full shadow-[4px_0_32px_rgba(0,0,0,0.45)]">
      {/* Logo */}
      <div className="border-b border-slate-800/60 px-3 py-2.5">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 96 56" className="w-12 h-[30px] shrink-0" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="px-card-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e3a5f"/>
                <stop offset="100%" stopColor="#172554"/>
              </linearGradient>
              <linearGradient id="px-wave" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#5b7cf9"/>
                <stop offset="50%" stopColor="#38bdf8"/>
                <stop offset="100%" stopColor="#22d3ee"/>
              </linearGradient>
            </defs>
            <rect width="56" height="56" rx="13" fill="url(#px-card-bg)"/>
            <path d="M7 28 C18 10, 34 10, 48 28 S72 46, 88 28" stroke="url(#px-wave)" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
            <circle cx="7"  cy="28" r="3.5" fill="#5b7cf9"/>
            <circle cx="48" cy="28" r="3.5" fill="#38bdf8"/>
            <circle cx="88" cy="28" r="3.5" fill="#22d3ee"/>
          </svg>
          <div className="min-w-0">
            <svg viewBox="0 0 130 32" className="w-20 h-auto" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="px-text" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6b8ef5"/>
                  <stop offset="100%" stopColor="#22d3ee"/>
                </linearGradient>
              </defs>
              <text x="0" y="24" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="24" fill="url(#px-text)">FLUXO</text>
            </svg>
            <p className="text-[9px] font-semibold text-slate-400 tracking-wider uppercase -mt-1">Gestione Acquisti</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto px-2.5">
        {/* Dashboard */}
        <a href="#" className={navLink(active === 'dashboard')}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="truncate">Dashboard</span>
        </a>

        {/* Fornitori accordion */}
        <div>
          <button
            onClick={() => setFornitoriOpen(o => !o)}
            className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors border-l-2 pl-[9px] ${
              active === 'suppliers'
                ? 'bg-cyan-500/15 text-white border-cyan-500'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border-transparent'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">Fornitori</span>
              <span className="text-[10px] bg-slate-700/60 text-slate-500 px-1.5 py-0.5 rounded-full shrink-0">2</span>
            </span>
            <svg className={`w-3 h-3 shrink-0 transition-transform ${fornitoriOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {fornitoriOpen && (
            <div className="ml-3.5 mt-0.5 space-y-0.5 border-l border-slate-800 pl-2.5">
              {/* Tutti i fornitori */}
              <a href="#" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium text-slate-500 hover:bg-slate-800/60 hover:text-slate-300 transition-colors">
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span className="truncate">Tutti i fornitori</span>
              </a>
              {/* Individual suppliers */}
              {suppliers.map((s, i) => (
                <a key={s} href="#" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${i === 0 && active === 'suppliers' ? 'bg-cyan-500/15 text-white' : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-100'}`}>
                  <span className={`w-1 h-1 rounded-full shrink-0 ${i === 0 && active === 'suppliers' ? 'bg-cyan-400' : 'bg-current opacity-50'}`} />
                  <span className="truncate">{s}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Log Email */}
        <a href="#" className={navLink(active === 'log')}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="truncate">Log Email</span>
        </a>
      </nav>

      {/* Operator row */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px] font-bold text-cyan-300 shrink-0">S</div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-600 leading-none mb-0.5 uppercase tracking-wide font-semibold">Operatore</p>
            <p className="text-[11px] text-slate-300 truncate font-medium leading-none">Staff Mediterran…</p>
          </div>
          <button className="p-1 text-slate-600 hover:text-cyan-400 rounded-md transition-colors shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 px-3 py-3 space-y-1">
        {/* Language */}
        <button className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-600 hover:text-slate-300 hover:bg-slate-800/60 rounded-lg transition-colors text-[11px]">
          <span className="text-sm leading-none">🇮🇹</span>
          <span className="font-medium">Italiano</span>
          <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        </button>
        {/* Nuova Bolla */}
        <a href="#" className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-[0_0_12px_rgba(6,182,212,0.25)]">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuova Bolla
        </a>
        {/* Settings */}
        <a href="#" className="flex items-center gap-2.5 w-full px-2.5 py-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 text-xs font-medium rounded-lg transition-colors border-l-2 border-transparent pl-[9px]">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Impostazioni</span>
        </a>
        {/* Logout */}
        <button className="flex items-center gap-2.5 w-full px-2.5 py-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 text-xs font-medium rounded-lg transition-colors">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Esci</span>
        </button>
      </div>
    </aside>
  )
}

/* ════════════════════════════════════════════════════════════════════
   DESKTOP LAYOUTS
════════════════════════════════════════════════════════════════════ */

function DLayout0() {
  const [scanning, setScanning] = useState(false)
  const handleScan = () => { setScanning(true); setTimeout(() => setScanning(false), 2500) }

  return (
    <div className="flex h-full min-h-[540px]">
      <MockSidebar active="dashboard" />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-gray-200 bg-white px-5 py-3 flex items-center gap-3 flex-shrink-0">
          <h1 className="text-sm font-bold text-gray-800 mr-auto">Dashboard</h1>
          <button onClick={handleScan} className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${scanning ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
            <svg className={`w-3.5 h-3.5 shrink-0 ${scanning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {scanning ? 'Scanning…' : 'Scan Emails'}
          </button>
          <button className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Send Reminders
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-3 gap-4 content-start">
          {/* Alert banner */}
          <div className="col-span-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-orange-500">⚠</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-orange-700">3 documents need attention</p>
              <p className="text-[11px] text-orange-500">2 missing invoices · 1 amount error</p>
            </div>
            <button className="text-xs font-semibold text-orange-600 underline">View all</button>
          </div>

          {/* Recent docs table */}
          <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-700">Recent Documents</p>
              <button className="text-xs text-blue-500">View all →</button>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide">
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-left font-semibold">Number</th>
                <th className="px-4 py-2 text-left font-semibold">Supplier</th>
                <th className="px-4 py-2 text-left font-semibold">Date</th>
                <th className="px-4 py-2 text-right font-semibold">Amount</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {MOCK_DOCS.map(doc => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeCls[doc.color]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dotCls[doc.color]}`} />{doc.badge}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-gray-700">{doc.number}</td>
                    <td className="px-4 py-2.5 text-gray-600 truncate max-w-[120px]">{doc.supplier}</td>
                    <td className="px-4 py-2.5 text-gray-400">{doc.date}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-gray-800 tabular-nums">{doc.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Activity log */}
          <div className="col-span-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-gray-700">Activity Log</p>
            </div>
            <div className="divide-y divide-gray-50">
              {ACTIVITY_LOG.map((entry, i) => (
                <div key={i} className="px-4 py-2.5 flex items-start gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${activityDot[entry.color]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-700 leading-snug">{entry.text}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{entry.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supplier strip */}
          <div className="col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold text-gray-700 mb-3">Suppliers</p>
            <div className="flex gap-3">
              {['AP', 'OB', 'DF', 'ML', 'GH', 'RS'].map((ini, i) => (
                <button key={ini} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-500 text-white text-xs font-bold flex items-center justify-center shadow">{ini}</div>
                  <span className="text-[10px] text-gray-400">{['Amalfi', 'Oral-B', 'DeFris', 'Milano', 'GH Ltd', 'RoSal'][i]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DLayout1() {
  const [selected, setSelected] = useState(MOCK_DOCS[0])
  const [filter, setFilter] = useState('All')

  const filters = ['All', 'Matched', 'Missing', 'Error']
  const filtered = filter === 'All' ? MOCK_DOCS : MOCK_DOCS.filter(d =>
    filter === 'Matched' ? d.color === 'green' :
    filter === 'Missing' ? d.color === 'orange' || d.color === 'amber' : d.color === 'red'
  )

  return (
    <div className="flex h-full min-h-[540px]">
      <MockSidebar active="suppliers" />
      {/* Left panel: list */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        {/* Search + filters */}
        <div className="p-3 border-b border-gray-100 space-y-2">
          <input type="text" placeholder="Search documents…" className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <div className="flex gap-1 flex-wrap">
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all ${filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{f}</button>
            ))}
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.map(doc => (
            <button key={doc.id} onClick={() => setSelected(doc)} className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selected.id === doc.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeCls[doc.color]}`}>{doc.badge}</span>
                <span className="ml-auto text-[10px] text-gray-400">{doc.date}</span>
              </div>
              <p className="text-xs font-bold text-gray-800 font-mono">{doc.number}</p>
              <p className="text-[11px] text-gray-500 truncate">{doc.supplier}</p>
              <p className="text-xs font-bold text-gray-900 mt-1 tabular-nums">{doc.amount}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel: preview */}
      <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3">
          <div>
            <p className="text-xs text-gray-400">Selected document</p>
            <p className="text-sm font-bold text-gray-800 font-mono">{selected.number}</p>
          </div>
          <div className="ml-auto flex gap-2">
            {selected.actions.map(a => (
              <button key={a} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${a === 'Email' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-gray-900 text-white'}`}>
                {a === 'Email'
                  ? <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>Email</>
                  : <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>View</>
                }
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-5 grid grid-cols-2 gap-4 content-start overflow-y-auto">
          {/* PDF placeholder */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-gray-700">Document Preview</p>
            </div>
            <div className="flex items-center justify-center h-52 bg-gray-50">
              <div className="text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                <p className="text-xs text-gray-400">PDF preview</p>
                <p className="text-[10px] text-gray-300 mt-1">{selected.number}.pdf</p>
              </div>
            </div>
          </div>

          {/* OCR extracted data */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-700">OCR Extracted Data</p>
              <span className="text-[10px] bg-green-50 text-green-600 border border-green-100 px-2 py-0.5 rounded-full font-semibold">AI ✓</span>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                { label: 'Supplier',   value: selected.supplier },
                { label: 'Date',       value: selected.date },
                { label: 'Amount',     value: selected.amount },
                { label: 'Status',     value: selected.badge },
                { label: 'Reference',  value: selected.number },
              ].map(row => (
                <div key={row.label} className="px-4 py-2.5 flex items-center gap-3">
                  <p className="text-[10px] text-gray-400 w-20 flex-shrink-0 font-semibold uppercase tracking-wide">{row.label}</p>
                  <p className="text-xs text-gray-800 font-medium">{row.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Batch action hint */}
          <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-xs text-blue-600">Select multiple rows in the list to perform batch actions (e.g. send reminders to all Missing documents at once).</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DLayout2() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('All')

  const summary = [
    { label: 'Matched',  count: 1, color: 'green' },
    { label: 'Missing',  count: 1, color: 'orange' },
    { label: 'DDT Miss', count: 1, color: 'amber' },
  ]

  return (
    <div className="flex min-h-[540px]">
      <MockSidebar active="dashboard" />
    <div className="flex flex-col flex-1 bg-gray-50">
      {/* Summary bar */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <h1 className="text-sm font-bold text-gray-800 mr-4">Verification Status</h1>
        {summary.map(s => (
          <button key={s.label} onClick={() => setStatusFilter(statusFilter === s.label ? 'All' : s.label)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${statusFilter === s.label ? `${badgeCls[s.color]} shadow` : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}>
            <span className={`w-2 h-2 rounded-full ${dotCls[s.color]}`} />
            {s.label} <span className="font-bold">· {s.count}</span>
          </button>
        ))}
        <button onClick={() => setStatusFilter('All')} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Clear filter</button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 text-left font-semibold w-8"></th>
                <th className="px-4 py-3 text-left font-semibold">Reference</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Stmt Date</th>
                <th className="px-4 py-3 text-left font-semibold">Sys Date</th>
                <th className="px-4 py-3 text-right font-semibold">Stmt Amount</th>
                <th className="px-4 py-3 text-right font-semibold">Sys Amount</th>
                <th className="px-4 py-3 text-left font-semibold">Checks</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_STATEMENTS.map(stmt => {
                const isOpen = expanded === stmt.id
                return (
                  <>
                    <tr key={stmt.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setExpanded(isOpen ? null : stmt.id)}>
                      <td className="px-4 py-3 text-gray-300 text-center">{isOpen ? '▲' : '▼'}</td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-700">{stmt.ref}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeCls[stmt.statusColor]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dotCls[stmt.statusColor]}`} />{stmt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{stmt.stmtDate}</td>
                      <td className={`px-4 py-3 ${stmt.sysDate === '—' ? 'text-red-400 font-bold' : 'text-gray-600'}`}>{stmt.sysDate}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800 tabular-nums">{stmt.stmtAmount}</td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${stmt.sysAmount === '—' ? 'text-red-400' : 'text-gray-800'}`}>{stmt.sysAmount}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-0.5">
                          {[1,2,3].map(n => <div key={n} className={`h-1.5 w-5 rounded-full ${n <= stmt.checks ? 'bg-green-400' : 'bg-gray-200'}`} />)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {stmt.missingField && <button className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-orange-500 text-white"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>Reminder</button>}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${stmt.id}-exp`} className="bg-blue-50/50 border-b border-blue-100">
                        <td colSpan={9} className="px-8 py-4">
                          <div className="grid grid-cols-2 gap-4 max-w-xl">
                            {[{ label: 'Date', stmt: stmt.stmtDate, sys: stmt.sysDate }, { label: 'Amount', stmt: stmt.stmtAmount, sys: stmt.sysAmount }].map(row => (
                              <div key={row.label} className="flex items-center gap-3">
                                <span className="text-[10px] text-gray-400 w-14 font-semibold uppercase tracking-wide">{row.label}</span>
                                <div className="bg-white rounded-lg border border-gray-100 px-3 py-1.5 text-center flex-1">
                                  <p className="text-[9px] text-gray-400">Statement</p>
                                  <p className="text-xs font-bold text-gray-700">{row.stmt}</p>
                                </div>
                                <span className="text-gray-300">→</span>
                                <div className={`rounded-lg border px-3 py-1.5 text-center flex-1 ${row.sys === '—' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                                  <p className="text-[9px] text-gray-400">System {row.sys === '—' && '✗'}</p>
                                  <p className={`text-xs font-bold ${row.sys === '—' ? 'text-red-500' : 'text-gray-700'}`}>{row.sys}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  )
}

function DLayout3() {
  const [tab, setTab] = useState('Delivery Notes')
  const tabs = ['Delivery Notes', 'Invoices', 'Price List', 'Statement']

  return (
    <div className="flex min-h-[540px]">
      <MockSidebar active="suppliers" />
      {/* Left: supplier card */}
      <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-700 text-white px-5 py-5">
          <button className="text-[10px] text-gray-400 mb-3 flex items-center gap-1 hover:text-gray-200"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>Back to Suppliers</button>
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-bold mb-3">AP</div>
          <h2 className="text-sm font-bold">Amalfi Produce London</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">admin@amalfi.co.uk</p>
        </div>
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2 p-3 border-b border-gray-100">
          {[{ label: 'Invoices', value: '14' }, { label: 'Pending', value: '3' }, { label: 'DDT', value: '22' }, { label: 'Total', value: '£2.4k' }].map(k => (
            <div key={k.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-base font-bold text-gray-800">{k.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
        {/* Contacts */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Contacts</p>
          {MOCK_CONTACTS.map(c => (
            <div key={c.role} className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-[10px] flex-shrink-0">
                {c.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400">{c.role}</p>
                <p className="text-xs font-semibold text-gray-700 truncate">{c.name}</p>
              </div>
              <div className="flex gap-1">
                <a href={`tel:${c.phone}`} className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center text-green-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></a>
                <a href={`mailto:${c.email}`} className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: tab panel */}
      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-5 flex items-center gap-1">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {t}
            </button>
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 text-left font-semibold">Number</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {MOCK_DOCS.map(doc => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-gray-700">{doc.number}</td>
                    <td className="px-4 py-3 text-gray-500">{doc.date}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeCls[doc.color]}`}>{doc.badge}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800 tabular-nums">{doc.amount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {doc.actions.map(a => (
                          <button key={a} className={`inline-flex items-center justify-center text-[10px] font-semibold px-2 py-1 rounded-lg ${a === 'Email' ? 'bg-blue-50 text-blue-600' : 'bg-gray-900 text-white'}`}>{a === 'Email' ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>}</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function DLayout4() {
  const [section, setSection] = useState('Localisation')
  const [saved, setSaved] = useState(false)
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const sections = ['Localisation', 'Utility Conversion', 'Notifications', 'Integrations', 'Users']

  return (
    <div className="flex min-h-[540px]">
      <MockSidebar active="settings" />
      {/* Section nav */}
      <div className="w-40 bg-white border-r border-gray-200 flex-shrink-0 p-3 space-y-1">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-2">Settings</p>
        {sections.map(s => (
          <button key={s} onClick={() => setSection(s)} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${section === s ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <h2 className="text-sm font-bold text-gray-800">{section}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Sede: Mediterraneo – TEST</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {section === 'Localisation' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 grid grid-cols-2 gap-5">
                {[
                  { label: 'Language',    val: 'English (EN)',  opts: ['English (EN)', 'Italiano (IT)', 'Español (ES)', 'Français (FR)', 'Deutsch (DE)'] },
                  { label: 'Currency',    val: 'GBP (£)',        opts: ['GBP (£)', 'EUR (€)', 'USD ($)', 'CHF (Fr)'] },
                  { label: 'Timezone',    val: 'Europe/London',  opts: ['Europe/London', 'Europe/Rome', 'Europe/Paris'] },
                  { label: 'Date Format', val: 'DD/MM/YYYY',     opts: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] },
                ].map(f => (
                  <div key={f.label}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">{f.label}</label>
                    <select defaultValue={f.val} className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {f.opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
          {section === 'Utility Conversion' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 grid grid-cols-2 gap-5">
                {[{ label: 'Metric Conversion Factor', val: '1.02264' }, { label: 'Calorific Value (kWh/m³)', val: '10.98' }, { label: 'VAT Rate (%)', val: '20' }, { label: 'Standing Charge (£/day)', val: '0.28' }].map(f => (
                  <div key={f.label}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">{f.label}</label>
                    <input type="text" defaultValue={f.val} className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {section !== 'Localisation' && section !== 'Utility Conversion' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center justify-center h-40">
              <p className="text-sm text-gray-300">— {section} settings panel —</p>
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-end gap-3 flex-shrink-0 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
          <button className="px-5 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={handleSave} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${saved ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'}`}>
            {saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════════ */

const TABS = [
  { id: '0', label: '0 · Dashboard',    mDesc: 'Hero KPI + quick actions + alert banner + recent docs feed + supplier strip.',       dDesc: '3-column layout: sidebar nav + KPI, central docs table, live activity log on the right.' },
  { id: '1', label: '1 · Documents',    mDesc: 'Card list: status badge + doc number header, supplier / date / amount, actions.',    dDesc: 'Split-view: filterable list on the left, document preview + OCR data on the right.' },
  { id: '2', label: '2 · Verification', mDesc: 'Collapsible cards: tap to expand Statement vs System comparison row by row.',        dDesc: 'Table with expandable inline sub-rows, summary filter bar, progress check indicators.' },
  { id: '3', label: '3 · Supplier',     mDesc: 'Dark hero + KPIs, contact cards with direct call/email icons, section quick-nav.',   dDesc: 'Master-detail: supplier card + contacts on the left, full-height tab panel on the right.' },
  { id: '4', label: '4 · Settings',     mDesc: 'Full-width vertical stack: label above input, grouped sections, sticky Save bar.',   dDesc: 'Side nav for sections, 2-column form grid, Save/Cancel bar bottom-right.' },
]

const MOBILE_COMPONENTS: Record<string, React.ReactNode> = {
  '0': <MLayout0 />, '1': <MLayout1 />, '2': <MLayout2 />, '3': <MLayout3 />, '4': <MLayout4 />,
}
const DESKTOP_COMPONENTS: Record<string, React.ReactNode> = {
  '0': <DLayout0 />, '1': <DLayout1 />, '2': <DLayout2 />, '3': <DLayout3 />, '4': <DLayout4 />,
}

export default function PreviewLayoutsPage() {
  const [active, setActive] = useState('0')
  const [mode, setMode] = useState<'mobile' | 'desktop'>('mobile')
  const current = TABS.find(t => t.id === active)!
  const desc = mode === 'mobile' ? current.mDesc : current.dDesc

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-gray-200">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Layout Previews</p>
            {/* Mode toggle */}
            <div className="ml-auto flex bg-gray-100 rounded-full p-0.5 gap-0.5">
              <button onClick={() => setMode('mobile')} className={`text-xs font-semibold px-3 py-1 rounded-full transition-all ${mode === 'mobile' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>
                📱 Mobile
              </button>
              <button onClick={() => setMode('desktop')} className={`text-xs font-semibold px-3 py-1 rounded-full transition-all ${mode === 'desktop' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>
                🖥 Desktop
              </button>
            </div>
          </div>
          {/* Tab row */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActive(tab.id)} className={`whitespace-nowrap text-xs font-semibold px-4 py-2 rounded-full transition-all ${active === tab.id ? 'bg-gray-900 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {mode === 'mobile' ? (
          <div className="grid md:grid-cols-[1fr_375px] gap-10 items-start">
            {/* Description */}
            <div className="space-y-4 md:sticky md:top-36">
              <div>
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">📱 Mobile layout</span>
                <h2 className="text-2xl font-bold text-gray-800 mt-1">{current.label}</h2>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">{desc}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Status colours</p>
                <div className="space-y-2">
                  {[{ color: 'green', label: 'Matched / OK' }, { color: 'amber', label: 'DDT Missing' }, { color: 'orange', label: 'Invoice Missing' }, { color: 'red', label: 'Amount Error' }].map(l => (
                    <div key={l.label} className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${dotCls[l.color]}`} />
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeCls[l.color]}`}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">Switch to 🖥 Desktop to see the widescreen version</p>
            </div>
            {/* Phone */}
            <div>
              <Phone>{MOBILE_COMPONENTS[active]}</Phone>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">🖥 Desktop layout</span>
              <h2 className="text-2xl font-bold text-gray-800 mt-1">{current.label}</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{desc}</p>
            </div>
            <Browser>{DESKTOP_COMPONENTS[active]}</Browser>
          </div>
        )}
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'

/** Voce di menu «Strumenti»: punta al pannello centralizzato. */
export default function StrumentiIndexPage() {
  redirect('/strumenti/centro-operazioni')
}

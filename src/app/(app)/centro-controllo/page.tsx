import { redirect } from 'next/navigation'

/** Compat: vecchio URL → sezione Strumenti con tab bar condivisa. */
export default function CentroControlloRedirectPage() {
  redirect('/strumenti/centro-controllo')
}

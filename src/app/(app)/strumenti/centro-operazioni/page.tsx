import { redirect } from 'next/navigation'

/** Pagina rimossa: strumenti operativi consolidati in Centro controllo. */
export default function CentroOperazioniRedirectPage() {
  redirect('/strumenti/centro-controllo')
}

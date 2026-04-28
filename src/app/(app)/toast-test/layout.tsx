import type { Metadata } from 'next'

/** Pagina solo prove UI — esclusa da indicizzazione. */
export const metadata: Metadata = {
  title: 'Prova toast',
  robots: { index: false, follow: false },
}

export default function ToastTestLayout({ children }: { children: React.ReactNode }) {
  return children
}

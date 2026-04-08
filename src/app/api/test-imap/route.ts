import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'

async function tryConnect(host: string, port: number, secure: boolean, user: string, password: string) {
  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass: password },
    logger: false,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  })
  await client.connect()
  await client.logout()
}

function humanizeError(err: unknown, host: string): string {
  const raw = err instanceof Error ? err.message : String(err)
  // imapflow wraps errors: get the response text if available
  const responseText = (err as Record<string, unknown>)?.response as string ?? ''
  const combined = `${raw} ${responseText}`.toLowerCase()

  console.error('[test-imap] error raw:', raw)
  console.error('[test-imap] error response:', responseText)
  console.error('[test-imap] error full:', err)

  if (combined.includes('535') || combined.includes('534') || combined.includes('auth') || combined.includes('credential') || combined.includes('password') || combined.includes('login failed')) {
    return 'Credenziali non valide. Controlla email e password (usa App Password per Gmail/Outlook).'
  }
  if (combined.includes('imap') && (combined.includes('disabled') || combined.includes('not enabled') || combined.includes('access'))) {
    return `IMAP non abilitato sull'account ${host}. Attivalo nelle impostazioni email.`
  }
  if (combined.includes('econnrefused')) {
    return `Connessione rifiutata da ${host}:${combined.includes('993') ? '993' : '143'}. Verifica l'host e che IMAP sia abilitato.`
  }
  if (combined.includes('etimedout') || combined.includes('timeout')) {
    return `Timeout connessione a ${host}. L'host potrebbe essere errato o la porta bloccata.`
  }
  if (combined.includes('enotfound') || combined.includes('getaddrinfo')) {
    return `Host "${host}" non trovato. Controlla l'indirizzo del server IMAP.`
  }
  if (combined.includes('command failed')) {
    return `Il server ${host} ha rifiutato il comando. Possibili cause: IMAP disabilitato sull'account, App Password richiesta, o accesso bloccato da una policy di sicurezza.`
  }
  return `Errore: ${raw}${responseText ? ' — ' + responseText : ''}`
}

export async function POST(req: NextRequest) {
  let host = ''
  try {
    const body = await req.json()
    host = body.host ?? ''
    const { port, user, password } = body

    if (!host || !user || !password) {
      return NextResponse.json({ error: 'Host, utente e password sono obbligatori.' }, { status: 400 })
    }

    const portNum = Number(port) || 993

    // Prima prova SSL (porta scelta), poi STARTTLS 143 come fallback
    try {
      await tryConnect(host, portNum, portNum !== 143, user, password)
    } catch (firstErr) {
      if (portNum === 993) {
        try {
          await tryConnect(host, 143, false, user, password)
          return NextResponse.json({
            message: `Connessione riuscita a ${host} tramite STARTTLS (porta 143). Aggiorna la porta a 143.`
          })
        } catch {
          // Fallback fallito, propaga errore originale
        }
      }
      throw firstErr
    }

    return NextResponse.json({ message: `✓ Connessione riuscita a ${host} come ${user}.` })
  } catch (err: unknown) {
    return NextResponse.json({ error: humanizeError(err, host) }, { status: 400 })
  }
}

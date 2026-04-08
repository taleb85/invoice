import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'

export async function POST(req: NextRequest) {
  try {
    const { host, port, user, password } = await req.json()

    if (!host || !user || !password) {
      return NextResponse.json({ error: 'Host, utente e password sono obbligatori.' }, { status: 400 })
    }

    const client = new ImapFlow({
      host,
      port: port ?? 993,
      secure: true,
      auth: { user, pass: password },
      logger: false,
    })

    await client.connect()
    await client.logout()

    return NextResponse.json({ message: `Connessione riuscita a ${host} come ${user}.` })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    return NextResponse.json({ error: `Connessione fallita: ${message}` }, { status: 400 })
  }
}

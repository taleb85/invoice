import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Recupera il log
  const { data: log, error: logError } = await supabase
    .from('log_sincronizzazione')
    .select('*')
    .eq('id', id)
    .single()

  if (logError || !log) {
    return NextResponse.json({ error: 'Log non trovato.' }, { status: 404 })
  }

  if (log.stato !== 'bolla_non_trovata') {
    return NextResponse.json({ error: 'Il retry è disponibile solo per log con stato "bolla_non_trovata".' }, { status: 400 })
  }

  if (!log.fornitore_id || !log.file_url) {
    return NextResponse.json({ error: 'Dati insufficienti nel log per eseguire il retry.' }, { status: 400 })
  }

  // 2. Cerca la bolla più vecchia ancora 'in attesa' per quel fornitore
  const { data: bolle } = await supabase
    .from('bolle')
    .select('id')
    .eq('fornitore_id', log.fornitore_id)
    .eq('stato', 'in attesa')
    .order('data', { ascending: true })
    .limit(1)

  if (!bolle || bolle.length === 0) {
    return NextResponse.json({ error: 'Nessuna bolla "in attesa" disponibile per questo fornitore.' }, { status: 404 })
  }

  const bollaId = bolle[0].id
  const oggi = new Date().toISOString().split('T')[0]

  // 3. Inserisci la fattura con il file già in storage
  const { error: insertError } = await supabase.from('fatture').insert([{
    fornitore_id: log.fornitore_id,
    bolla_id: bollaId,
    data: oggi,
    file_url: log.file_url,
  }])

  if (insertError) {
    return NextResponse.json({ error: `Errore inserimento fattura: ${insertError.message}` }, { status: 500 })
  }

  // 4. Chiude la bolla
  await supabase.from('bolle').update({ stato: 'completato' }).eq('id', bollaId)

  // 5. Aggiorna il log a 'successo'
  await supabase
    .from('log_sincronizzazione')
    .update({ stato: 'successo', errore_dettaglio: null })
    .eq('id', id)

  return NextResponse.json({ successo: true })
}

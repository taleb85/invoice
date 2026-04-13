import type { SupabaseClient } from '@supabase/supabase-js'

function normEmail(raw: string | null | undefined): string | null {
  const s = raw?.trim().toLowerCase()
  if (!s || !s.includes('@')) return null
  return s
}

/**
 * Dopo un'associazione manuale documento → fornitore, incrementa il contatore
 * mittente/fornitore e indica se conviene proporre di salvare l'alias email.
 */
export async function recordManualSupplierAssociation(
  supabase: SupabaseClient,
  opts: { mittente: string; fornitoreId: string }
): Promise<{ count: number; suggestRemember: boolean }> {
  const email = normEmail(opts.mittente)
  if (!email) return { count: 0, suggestRemember: false }

  const { data: row } = await supabase
    .from('mittente_fornitore_assoc_stats')
    .select('id, association_count')
    .eq('mittente_email', email)
    .eq('fornitore_id', opts.fornitoreId)
    .maybeSingle()

  let count = 1
  if (row?.id) {
    count = (row.association_count ?? 0) + 1
    await supabase
      .from('mittente_fornitore_assoc_stats')
      .update({ association_count: count, updated_at: new Date().toISOString() })
      .eq('id', row.id)
  } else {
    await supabase.from('mittente_fornitore_assoc_stats').insert([
      {
        mittente_email: email,
        fornitore_id: opts.fornitoreId,
        association_count: 1,
      },
    ])
  }

  const already = await senderAlreadyLinkedToFornitore(supabase, email, opts.fornitoreId)
  const suggestRemember = count >= 2 && !already

  return { count, suggestRemember }
}

export async function senderAlreadyLinkedToFornitore(
  supabase: SupabaseClient,
  emailNorm: string,
  fornitoreId: string
): Promise<boolean> {
  const { data: alias } = await supabase
    .from('fornitore_emails')
    .select('id')
    .eq('fornitore_id', fornitoreId)
    .ilike('email', emailNorm)
    .maybeSingle()
  if (alias) return true

  const { data: f } = await supabase
    .from('fornitori')
    .select('email')
    .eq('id', fornitoreId)
    .maybeSingle()
  const main = f?.email?.trim().toLowerCase()
  return !!main && main === emailNorm
}

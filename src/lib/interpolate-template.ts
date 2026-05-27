/** Sostituisce `{chiave}` nel template; se manca il template ritorna `fallback`. */
export function interpolateTemplate(
  template: string | undefined | null,
  vars: Record<string, string | number>,
  fallback = '',
): string {
  if (!template) return fallback
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  )
}

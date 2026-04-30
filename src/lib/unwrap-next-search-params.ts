/**
 * Next.js 15+ espone `searchParams` nei Page RSC come `Promise`.
 * Usare sempre `unwrapSearchParams(props.searchParams)` al posto di
 * `props.searchParams != null ? await props.searchParams : {}`, così si evita
 * l’avviso / dev-overlay «params/searchParams enumerated» (sync-dynamic-apis).
 */
export async function unwrapSearchParams<
  T extends Record<string, string | string[] | undefined>,
>(sp: Promise<T> | undefined | null): Promise<Partial<T>> {
  return await (sp ?? Promise.resolve({} as Partial<T>))
}

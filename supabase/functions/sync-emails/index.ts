import "@supabase/functions-js/edge-runtime.d.ts"

/** Default pubblico dell’app (override con secret NEXT_PUBLIC_SITE_URL se serve). */
const DEFAULT_SITE_URL = "https://smart-pair-psi-six.vercel.app"

/**
 * Cron orario hostato da Supabase: GET /api/cron/sync-emails sulla Vercel app.
 * Secrets progetto Supabase: CRON_SECRET (uguale a Vercel),
 * NEXT_PUBLIC_SITE_URL opzionale (fallback sopra).
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 })
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "GET, POST, OPTIONS",
      },
    })
  }

  const cronSecret = Deno.env.get("CRON_SECRET")?.trim()
  const rawSite =
    Deno.env.get("NEXT_PUBLIC_SITE_URL")?.trim() || DEFAULT_SITE_URL
  const siteUrl = rawSite.replace(/\/+$/, "")

  if (!cronSecret) {
    return new Response(
      JSON.stringify({
        error: "Missing CRON_SECRET in Edge Function secrets (must match Vercel CRON_SECRET)",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  const res = await fetch(`${siteUrl}/api/cron/sync-emails`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
    },
  })

  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }

  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  })
})

import "@supabase/functions-js/edge-runtime.d.ts"

/**
 * Cron orario hostato da Supabase: invoca GET /api/cron/sync-emails sulla Vercel app.
 * Segreti progetto Supabase (Edge Function): NEXT_PUBLIC_SITE_URL, CRON_SECRET.
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

  const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL")
  const cronSecret = Deno.env.get("CRON_SECRET")

  if (!siteUrl?.trim() || !cronSecret) {
    return new Response(
      JSON.stringify({
        error: "Missing NEXT_PUBLIC_SITE_URL or CRON_SECRET in Edge Function secrets",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  const base = siteUrl.replace(/\/+$/, "")
  const target = `${base}/api/cron/sync-emails`

  const res = await fetch(target, {
    method: "GET",
    headers: { Authorization: `Bearer ${cronSecret}` },
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

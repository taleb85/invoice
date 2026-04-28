import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "package.json"), "utf8"),
) as { version: string };

const securityHeaders = [
  // Disabilita il rilevamento automatico del MIME type (es. eseguire HTML camuffato da immagine)
  { key: "X-Content-Type-Options",   value: "nosniff" },
  // Impedisce l'embedding in iframe da origini esterne
  { key: "X-Frame-Options",          value: "SAMEORIGIN" },
  // Protezione XSS legacy (per browser che non supportano CSP)
  { key: "X-XSS-Protection",         value: "1; mode=block" },
  // Non inviare il Referer a siti di terze parti
  { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
  // Limita l'accesso a sensori del dispositivo non necessari
  { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=(self)" },
  // HSTS: forza HTTPS per 1 anno (attivato solo in produzione via header)
  {
    key:   "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  /**
   * Fast Refresh (client): attivo di default con `next dev`; l’unico flag CLI che lo altera è
   * `--no-server-fast-refresh` (solo refresh lato server). Turbopack: `next dev --turbopack` (equiv. `--turbo`).
   */
  /** Espone su client versione (`package.json`) e metadati deploy Vercel al build. */
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
  },

  // Rimuove l'header X-Powered-By: Next.js per non esporre il framework in produzione
  poweredByHeader: false,

  /** Evita che il badge di sviluppo (N) copra la prima icona della bottom bar su mobile. */
  devIndicators: {
    position: "top-right",
  },

  turbopack: {},

  // Aggiunge security headers a tutte le rotte
  async headers() {
    return [
      {
        source:  "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Dominio di Supabase Storage per next/image (se usato in futuro)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname:  "*.supabase.co",
        pathname:  "/storage/v1/**",
      },
    ],
  },
};

export default nextConfig;

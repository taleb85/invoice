import type { NextConfig } from "next";

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
  // Rimuove l'header X-Powered-By: Next.js per non esporre il framework in produzione
  poweredByHeader: false,

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

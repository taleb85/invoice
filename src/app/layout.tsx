import type { Metadata, Viewport } from "next";
import { Geist, Outfit } from "next/font/google";
import Script from "next/script";
import PWARegister from "@/components/PWARegister";
import "./globals.css";

const APP_LOCALE_BOOTSTRAP = `(function(){
  try {
    var SUPPORTED = ['it','en','fr','de','es'];
    var m = document.cookie.match(/(?:^|; )app-locale=([^;]*)/);
    if (m && SUPPORTED.indexOf(decodeURIComponent(m[1])) !== -1) return;
    var langs = (navigator.languages && navigator.languages.length)
      ? Array.from(navigator.languages) : [navigator.language || 'en'];
    var detected = 'en';
    for (var i = 0; i < langs.length; i++) {
      var l = langs[i].split('-')[0].toLowerCase();
      if (SUPPORTED.indexOf(l) !== -1) { detected = l; break; }
    }
    document.cookie = 'app-locale=' + encodeURIComponent(detected) +
      '; path=/; max-age=31536000; SameSite=Lax';
  } catch(e) {}
})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-outfit",
  display: "swap",
});

/** Risolve URL assoluti per Open Graph / Twitter (avviso Next.js in build se assente). */
function siteMetadataBase(): URL {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return new URL(fromEnv)
  if (process.env.VERCEL_URL?.trim()) return new URL(`https://${process.env.VERCEL_URL}`)
  return new URL("http://localhost:3000")
}

export const viewport: Viewport = {
  themeColor: "#0a192f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  /** Riempie safe area (notch) senza modificare la palette dell'app. */
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: siteMetadataBase(),
  title: "Smart Pair",
  description: "Invoice Management",
  manifest: "/manifest.json",
  openGraph: {
    title: "Smart Pair",
    description: "Invoice Management",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Smart Pair",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "application-name": "Smart Pair",
    "msapplication-TileColor": "#020617",
    "msapplication-TileImage": "/icons/icon-512.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${geistSans.variable} ${outfit.variable} h-full antialiased`}>
      <body
        className="h-dvh min-h-dvh text-app-fg-muted antialiased"
        style={{
          backgroundColor: "#0a192f",
          color: "#ffffff"
        }}
      >
        <Script
          id="fluxo-app-locale-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: APP_LOCALE_BOOTSTRAP }}
        />
        <PWARegister />
        {children}
      </body>
    </html>
  );
}

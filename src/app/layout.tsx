import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
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

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "FLUXO",
  description: "Gestione acquisti, bolle e fatture fornitori",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FLUXO",
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
    "application-name": "FLUXO",
    "msapplication-TileColor": "#0f172a",
    "msapplication-TileImage": "/icons/icon-512.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${geistSans.variable} h-full antialiased`}>
      <body
        className="h-full min-h-dvh bg-slate-950 text-slate-100 antialiased"
        style={{ backgroundColor: "#020617", color: "#e2e8f0" }}
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

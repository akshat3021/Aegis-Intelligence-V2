import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aegis Intelligence",
  description: "Your AI companion for productivity, goals, and motivation.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aegis",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/aegis-logo.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#050508" },
    { media: "(prefers-color-scheme: light)", color: "#F59E0B" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* SVG favicon — shows the Aegis hex logo in browser tab */}
        <link rel="icon" href="/aegis-logo.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#050508" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Aegis" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#050508", overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
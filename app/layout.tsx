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
    // Bug #2 fix: only reference files that actually exist
    icon: [{ url: "/aegis-logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/aegis-logo.svg" }],
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
        {/* Bug #23 fix: Google Fonts loaded here (in <head>) instead of via
            CSS @import inside JSX <style> tags, which is render-blocking.
            Preconnect reduces DNS lookup time for the font domains. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Bubblegum+Sans&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap"
        />

        {/* Bug #2 fix: only reference the SVG icon that actually exists */}
        <link rel="icon" href="/aegis-logo.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/aegis-logo.svg" />
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
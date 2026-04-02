"use client";

import { useState, useEffect } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Once you build your APK, upload it somewhere and paste the link here.
// Free hosting options:
//   - GitHub Releases (best): upload APK to your repo's releases page
//   - Google Drive: share link with "anyone with link"
//   - Firebase Hosting: free tier
const APK_DOWNLOAD_URL = "YOUR_APK_DOWNLOAD_LINK_HERE";
// Example: "https://github.com/yourusername/aegis-intelligence/releases/download/v1.0/aegis.apk"

const PLAY_STORE_URL = ""; // Leave empty until you publish to Play Store
const APP_STORE_URL = "";  // Leave empty until you publish to App Store

export default function AppDownloadBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCapacitor, setIsCapacitor] = useState(false);

  useEffect(() => {
    // Detect if running inside Capacitor native app → hide banner completely
    const inCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
    setIsCapacitor(inCapacitor);
    if (inCapacitor) return;

    const ua = navigator.userAgent;
    const android = /android/i.test(ua);
    const ios = /iphone|ipad|ipod/i.test(ua);
    const mobile = android || ios || window.innerWidth < 768;

    setIsAndroid(android);
    setIsIOS(ios);
    setIsMobile(mobile);

    // Check if user already dismissed this session
    const wasDismissed = sessionStorage.getItem("aegis_banner_dismissed");
    if (!wasDismissed) {
      // Small delay so it doesn't flash immediately on load
      setTimeout(() => setShow(true), 2000);
    }
  }, []);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem("aegis_banner_dismissed", "1");
  };

  const handleDownload = () => {
    const url = isAndroid && PLAY_STORE_URL
      ? PLAY_STORE_URL
      : isIOS && APP_STORE_URL
      ? APP_STORE_URL
      : APK_DOWNLOAD_URL;

    if (url && url !== "YOUR_APK_DOWNLOAD_LINK_HERE") {
      window.open(url, "_blank");
    } else {
      alert("APK coming soon! Check back later.");
    }
  };

  // Don't render if inside Capacitor app, or dismissed, or not ready
  if (isCapacitor || dismissed || !show) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Share+Tech+Mono&display=swap');

        /* ── MOBILE BANNER (top of screen, like Spotify/YouTube) ── */
        .app-banner-mobile {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 9999;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          background: #0F0F12;
          border-bottom: 1px solid rgba(245,158,11,0.3);
          box-shadow: 0 2px 20px rgba(0,0,0,0.5);
          animation: banner-slide-down 0.4s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes banner-slide-down {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }

        /* ── DESKTOP BANNER (bottom-right corner, like Google/Amazon) ── */
        .app-banner-desktop {
          position: fixed;
          bottom: 24px; right: 24px;
          z-index: 9999;
          width: 300px;
          background: rgba(10,10,14,0.95);
          border: 1px solid rgba(245,158,11,0.3);
          border-radius: 16px;
          padding: 18px 20px;
          box-shadow:
            0 0 40px rgba(245,158,11,0.08),
            0 20px 60px rgba(0,0,0,0.6),
            inset 0 1px 0 rgba(245,158,11,0.1);
          backdrop-filter: blur(20px);
          animation: banner-slide-up 0.5s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes banner-slide-up {
          from { transform: translateY(30px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        /* ── CORNER ACCENTS on desktop ── */
        .app-banner-desktop::before {
          content: '';
          position: absolute; top: -1px; left: -1px;
          width: 14px; height: 14px;
          border-top: 2px solid #F59E0B;
          border-left: 2px solid #F59E0B;
          border-radius: 2px 0 0 0;
        }
        .app-banner-desktop::after {
          content: '';
          position: absolute; bottom: -1px; right: -1px;
          width: 14px; height: 14px;
          border-bottom: 2px solid #F59E0B;
          border-right: 2px solid #F59E0B;
          border-radius: 0 0 2px 0;
        }

        .banner-dismiss {
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.3); font-size: 16px;
          line-height: 1; padding: 2px 4px;
          transition: color 0.2s;
          flex-shrink: 0;
        }
        .banner-dismiss:hover { color: rgba(255,255,255,0.7); }

        .banner-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: linear-gradient(135deg, #F59E0B, #D97706);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(245,158,11,0.3);
        }

        .banner-title {
          font-family: 'Rajdhani', sans-serif;
          font-size: 14px; font-weight: 700;
          color: white; letter-spacing: 0.02em;
          margin-bottom: 2px;
        }
        .banner-sub {
          font-family: 'Share Tech Mono', monospace;
          font-size: 9px; color: rgba(255,255,255,0.35);
          letter-spacing: 0.1em; text-transform: uppercase;
        }

        .banner-dl-btn {
          background: #F59E0B;
          color: #000;
          border: none;
          border-radius: 8px;
          padding: 9px 16px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          cursor: pointer; transition: all 0.2s;
          white-space: nowrap; flex-shrink: 0;
          clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);
        }
        .banner-dl-btn:hover {
          filter: brightness(1.15);
          box-shadow: 0 0 16px rgba(245,158,11,0.5);
        }

        .banner-dl-btn-full {
          width: 100%; margin-top: 14px;
          background: #F59E0B; color: #000;
          border: none; border-radius: 8px;
          padding: 11px; font-family: 'Share Tech Mono', monospace;
          font-size: 11px; font-weight: 700; letter-spacing: 0.15em;
          text-transform: uppercase; cursor: pointer; transition: all 0.2s;
          clip-path: polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%);
        }
        .banner-dl-btn-full:hover {
          filter: brightness(1.15);
          box-shadow: 0 0 20px rgba(245,158,11,0.4);
        }

        .banner-stores {
          display: flex; gap: 8px; margin-top: 12px;
        }
        .banner-store-btn {
          flex: 1; padding: 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; cursor: pointer;
          color: rgba(255,255,255,0.6);
          font-family: 'Rajdhani', sans-serif;
          font-size: 11px; font-weight: 600;
          transition: all 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .banner-store-btn:hover {
          border-color: rgba(245,158,11,0.4);
          color: white; background: rgba(245,158,11,0.06);
        }
        .banner-store-btn.soon {
          opacity: 0.4; cursor: default;
        }
        .banner-store-btn.soon:hover {
          border-color: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.05);
        }

        .banner-divider {
          height: 1px; background: rgba(255,255,255,0.06);
          margin: 14px 0 0;
        }
        .banner-rating {
          display: flex; align-items: center; gap: 4px;
          margin-top: 10px;
        }
        .banner-stars { color: #F59E0B; font-size: 11px; letter-spacing: 1px; }
        .banner-rating-text {
          font-family: 'Share Tech Mono', monospace;
          font-size: 9px; color: rgba(255,255,255,0.25);
          letter-spacing: 0.08em;
        }
      `}</style>

      {/* ══════════════════════════════════════
          MOBILE BANNER (top strip)
          Like Spotify / YouTube mobile
      ══════════════════════════════════════ */}
      {isMobile && (
        <div className="app-banner-mobile">
          <button className="banner-dismiss" onClick={handleDismiss}>✕</button>
          <div className="banner-icon">⚡</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="banner-title">Aegis Intelligence</div>
            <div className="banner-sub">
              {isIOS ? "Available on iOS" : "Free Android App"}
            </div>
          </div>
          <button className="banner-dl-btn" onClick={handleDownload}>
            {isIOS ? "GET APP" : "DOWNLOAD"}
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════
          DESKTOP BANNER (bottom-right card)
          Like Google Play prompts / Amazon
      ══════════════════════════════════════ */}
      {!isMobile && (
        <div className="app-banner-desktop">
          {/* Close button */}
          <button
            className="banner-dismiss"
            onClick={handleDismiss}
            style={{ position: "absolute", top: 12, right: 12 }}
          >✕</button>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingRight: "20px" }}>
            <div className="banner-icon">⚡</div>
            <div>
              <div className="banner-title">Aegis Intelligence</div>
              <div className="banner-sub">Mobile App — Free</div>
            </div>
          </div>

          {/* Rating */}
          <div className="banner-rating">
            <span className="banner-stars">★★★★★</span>
            <span className="banner-rating-text">YOUR AI COMPANION, ON THE GO</span>
          </div>

          <div className="banner-divider" />

          {/* Features */}
          <div style={{
            marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px"
          }}>
            {[
              "🤖  3D AI Companions",
              "🎙️  Voice interaction",
              "🎯  Goal tracking",
              "📴  Works offline",
            ].map((f, i) => (
              <div key={i} style={{
                fontFamily: "Rajdhani, sans-serif",
                fontSize: "12px", color: "rgba(255,255,255,0.55)",
                letterSpacing: "0.02em"
              }}>{f}</div>
            ))}
          </div>

          {/* Download buttons */}
          <div className="banner-stores">
            <button className="banner-store-btn" onClick={handleDownload}>
              <span>🤖</span> Android
            </button>
            <button
              className={`banner-store-btn ${!APP_STORE_URL ? "soon" : ""}`}
              onClick={() => APP_STORE_URL && window.open(APP_STORE_URL, "_blank")}
            >
              <span>🍎</span> {APP_STORE_URL ? "iOS" : "iOS Soon"}
            </button>
          </div>

          <button className="banner-dl-btn-full" onClick={handleDownload}>
            ↓ DOWNLOAD FREE APK
          </button>
        </div>
      )}
    </>
  );
}
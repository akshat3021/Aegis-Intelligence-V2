"use client";

interface Companion {
  id: string;
  name: string;
  bgColor: string;
  accent: string;
  accentRgb: string;
  theme: string;
  label: string;
}

interface Props {
  companions: Companion[];
  activeId: string;
  onSelect: (c: Companion) => void;
  isEva: boolean;
  isSpark: boolean;
  accentRgb: string;
  accent: string;
}

const COMPANION_INFO: Record<string, { emoji: string; personality: string; bestFor: string; color: string }> = {
  squish: {
    emoji: "🟡",
    personality: "Warm & Friendly",
    bestFor: "General help, motivation, day-to-day support",
    color: "#F59E0B",
  },
  eva: {
    emoji: "🤖",
    personality: "Precise & Technical",
    bestFor: "Coding, planning, analytical tasks",
    color: "#64748B",
  },
  spark: {
    emoji: "🌸",
    personality: "Hyper & Energetic",
    bestFor: "Brainstorming, creativity, hype sessions",
    color: "#EC4899",
  },
};

export default function CompanionSelector({ companions, activeId, onSelect, isEva, isSpark, accentRgb, accent }: Props) {
  const font = isEva ? "'Share Tech Mono',monospace" : isSpark ? "'Bubblegum Sans',cursive" : "'Fredoka',sans-serif";

  return (
    <div style={{
      display:"flex",
      gap:"8px",
      padding:"0 14px",
      flexDirection:"column" as const,
      alignItems:"center",
    }}>
      {/* Compact pill selector - always visible */}
      <div style={{
        display:"flex",
        gap:"6px",
        padding:"8px 14px",
        borderRadius:"40px",
        background:isEva?"rgba(0,0,0,.65)":"rgba(255,255,255,.65)",
        border:`1px solid rgba(${accentRgb},.2)`,
        backdropFilter:"blur(10px)",
        alignItems:"center",
      }}>
        {companions.map(c => {
          const isActive = c.id === activeId;
          const info = COMPANION_INFO[c.id];
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              title={`${c.name} — ${info?.personality}`}
              style={{
                display:"flex",
                alignItems:"center",
                gap:"6px",
                padding: isActive ? "6px 12px" : "6px 8px",
                borderRadius:"30px",
                border:"none",
                background: isActive ? c.bgColor : "transparent",
                cursor:"pointer",
                transition:"all .3s cubic-bezier(.34,1.56,.64,1)",
                transform: isActive ? "scale(1.05)" : "scale(1)",
                boxShadow: isActive ? `0 0 16px rgba(${c.accentRgb},.6)` : "none",
              }}>
              {/* Color dot */}
              <div style={{
                width: isActive ? "10px" : "22px",
                height: isActive ? "10px" : "22px",
                borderRadius:"50%",
                background: c.bgColor,
                border: isActive ? "2px solid white" : "2px solid transparent",
                flexShrink:0,
                transition:"all .3s",
                opacity: isActive ? 1 : 0.4,
              }}/>
              {/* Name - only show when active */}
              {isActive && (
                <span style={{
                  fontFamily: font,
                  fontSize: isEva ? "9px" : "12px",
                  fontWeight:700,
                  color: isEva ? "#000" : "#000",
                  letterSpacing: isEva ? ".1em" : "0",
                  textTransform: isEva ? "uppercase" : "none",
                  whiteSpace:"nowrap",
                }}>
                  {c.name}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active companion personality hint */}
      {(() => {
        const info = COMPANION_INFO[activeId];
        if (!info) return null;
        return (
          <div style={{
            fontFamily:"monospace",
            fontSize:"9px",
            letterSpacing:".1em",
            textTransform:"uppercase",
            color:`rgba(${accentRgb},.6)`,
          }}>
            {companions.find(c=>c.id===activeId)?.label}
          </div>
        );
      })()}
    </div>
  );
}

// ── FULL COMPANION CARD (for onboarding/profile) ──────────────────────────────
export function CompanionCard({ companions, activeId, onSelect, isEva, isSpark, accentRgb, accent }: Props) {
  const font = isEva ? "'Share Tech Mono',monospace" : isSpark ? "'Bubblegum Sans',cursive" : "'Fredoka',sans-serif";

  return (
    <div style={{width:"100%",display:"flex",flexDirection:"column",gap:"8px"}}>
      <div style={{fontFamily:"monospace",fontSize:"8px",opacity:.35,textTransform:"uppercase",marginBottom:"4px",letterSpacing:".12em"}}>
        CHOOSE COMPANION
      </div>
      {companions.map(c => {
        const isActive = c.id === activeId;
        const info = COMPANION_INFO[c.id];
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            style={{
              display:"flex",
              alignItems:"center",
              gap:"12px",
              padding:"10px 14px",
              borderRadius: isEva ? "6px" : "16px",
              border: `2px solid ${isActive ? c.accent : `rgba(${accentRgb},.15)`}`,
              background: isActive ? `rgba(${c.accentRgb},.1)` : "rgba(255,255,255,.04)",
              cursor:"pointer",
              transition:"all .25s",
              width:"100%",
              textAlign:"left" as const,
              boxShadow: isActive ? `0 0 16px rgba(${c.accentRgb},.2)` : "none",
            }}>
            {/* Color circle */}
            <div style={{
              width:"36px",height:"36px",borderRadius:"50%",
              background:c.bgColor,flexShrink:0,
              border: isActive ? "3px solid white" : "3px solid transparent",
              boxShadow: isActive ? `0 0 12px rgba(${c.accentRgb},.6)` : "none",
            }}/>
            {/* Info */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:font,fontSize:isEva?"10px":"14px",fontWeight:700,color:c.accent,letterSpacing:isEva?".1em":"0",textTransform:isEva?"uppercase":"none"}}>
                {c.name}
              </div>
              <div style={{fontFamily:"monospace",fontSize:"9px",opacity:.5,marginTop:"2px"}}>
                {info?.personality}
              </div>
            </div>
            {/* Active indicator */}
            {isActive && <div style={{width:"8px",height:"8px",borderRadius:"50%",background:c.accent,boxShadow:`0 0 6px rgba(${c.accentRgb},.8)`,flexShrink:0}}/>}
          </button>
        );
      })}
    </div>
  );
}
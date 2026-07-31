"use client";
import { useEffect, useRef } from "react";
// Bug #17 fix: import shared XP formula so ShareCard and page.tsx always agree
import { getXPForLvl } from "../lib/gameUtils";

interface Props {
  name: string;
  level: number;
  xp: number;
  streak: number;
  companionName: string;
  accent: string;
  accentRgb: string;
  theme: string;
  onClose: () => void;
}

export default function ShareCard({ name, level, xp, streak, companionName, accent, accentRgb, theme, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Card size: 1080x1080 (Instagram square)
    canvas.width = 1080;
    canvas.height = 1080;

    const isEva   = theme === "eva";
    const isSpark = theme === "spark";

    // ── BACKGROUND ──────────────────────────────────────────────────────────
    if (isEva) {
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, 1080, 1080);
      // Grid
      ctx.strokeStyle = "rgba(100,116,139,0.08)";
      ctx.lineWidth = 1;
      for (let x=0; x<1080; x+=60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,1080); ctx.stroke(); }
      for (let y=0; y<1080; y+=60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(1080,y); ctx.stroke(); }
    } else if (isSpark) {
      const grad = ctx.createLinearGradient(0,0,1080,1080);
      grad.addColorStop(0, "#FFF0F6");
      grad.addColorStop(0.5, "#FCE4EC");
      grad.addColorStop(1, "#F8BBD0");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1080);
      // Dots
      ctx.fillStyle = "rgba(236,72,153,0.06)";
      for (let x=30; x<1080; x+=60) for (let y=30; y<1080; y+=60) { ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill(); }
    } else {
      const grad = ctx.createLinearGradient(0,0,1080,1080);
      grad.addColorStop(0, "#FFFBEB");
      grad.addColorStop(0.6, "#FEF3C7");
      grad.addColorStop(1, "#FDE68A");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1080);
    }

    // ── BORDER ──────────────────────────────────────────────────────────────
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, 1000, 1000);
    // Corner accents
    const corners: [number, number][] = [[40,40],[1040,40],[40,1040],[1040,1040]];
    const sizes: [number, number][]   = [[1,1],[-1,1],[1,-1],[-1,-1]];
    corners.forEach(([cx,cy]: [number,number], i: number) => {
      const [dx,dy] = sizes[i];
      ctx.strokeStyle = accent;
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+dx*60,cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx,cy+dy*60); ctx.stroke();
    });

    // ── AEGIS LOGO (hexagon) ─────────────────────────────────────────────────
    const hex = (cx:number,cy:number,r:number) => {
      ctx.beginPath();
      for(let i=0;i<6;i++){
        const a=(Math.PI/3)*i - Math.PI/6;
        i===0?ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a)):ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
      }
      ctx.closePath();
    };
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    hex(540, 200, 80); ctx.stroke();
    hex(540, 200, 55); ctx.globalAlpha=0.3; ctx.stroke(); ctx.globalAlpha=1;
    ctx.beginPath(); ctx.arc(540,200,28,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(540,200,14,0,Math.PI*2); ctx.fill();

    // ── AEGIS TITLE ──────────────────────────────────────────────────────────
    ctx.fillStyle = accent;
    ctx.font = "bold 36px 'Share Tech Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("AEGIS INTELLIGENCE", 540, 340);

    ctx.fillStyle = isEva ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";
    ctx.font = "24px 'Share Tech Mono', monospace";
    ctx.fillText(`${companionName.toUpperCase()} COMPANION`, 540, 380);

    // ── DIVIDER ──────────────────────────────────────────────────────────────
    ctx.strokeStyle = `rgba(${accentRgb},0.3)`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(200,420); ctx.lineTo(880,420); ctx.stroke();

    // ── AGENT NAME ───────────────────────────────────────────────────────────
    ctx.fillStyle = isEva ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
    ctx.font = "28px 'Share Tech Mono', monospace";
    ctx.fillText("AGENT", 540, 490);
    ctx.fillStyle = isEva ? "white" : "#1F2937";
    ctx.font = "bold 72px Arial";
    ctx.fillText(name || "AGENT", 540, 570);

    // ── STATS ────────────────────────────────────────────────────────────────
    const stats = [
      { label: "LEVEL", value: String(level), icon: "⚡" },
      { label: "TOTAL XP", value: String(xp), icon: "✦" },
      { label: "STREAK", value: `${streak}🔥`, icon: "" },
    ];

    stats.forEach((s, i) => {
      const x = 180 + i * 360;
      const y = 660;

      // Card
      ctx.fillStyle = `rgba(${accentRgb},0.1)`;
      ctx.strokeStyle = `rgba(${accentRgb},0.3)`;
      ctx.lineWidth = 2;
      roundRect(ctx, x-100, y-60, 200, 160, 16);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = isEva ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";
      ctx.font = "22px 'Share Tech Mono', monospace";
      ctx.fillText(s.label, x, y-10);

      ctx.fillStyle = accent;
      ctx.font = "bold 56px Arial";
      ctx.fillText(s.value, x, y+70);
    });

    // Bug #17 fix: use shared formula from gameUtils (matches page.tsx exactly)
    const xpForNext  = getXPForLvl(level + 1);
    const xpCurrent  = getXPForLvl(level);
    const pct = xpForNext <= xpCurrent ? 0 : Math.min(100, ((xp - xpCurrent) / (xpForNext - xpCurrent)) * 100);

    ctx.fillStyle = `rgba(${accentRgb},0.15)`;
    roundRect(ctx, 160, 860, 760, 20, 10); ctx.fill();
    const grad2 = ctx.createLinearGradient(160,0,920,0);
    grad2.addColorStop(0, accent);
    grad2.addColorStop(1, accentRgb==="245,158,11"?"#FCD34D":accentRgb==="236,72,153"?"#F472B6":"#94A3B8");
    ctx.fillStyle = grad2;
    roundRect(ctx, 160, 860, 760*(pct/100), 20, 10); ctx.fill();

    ctx.fillStyle = isEva ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
    ctx.font = "22px 'Share Tech Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${xp} / ${xpForNext} XP TO NEXT LEVEL`, 920, 940);

    // ── FOOTER ───────────────────────────────────────────────────────────────
    ctx.fillStyle = `rgba(${accentRgb},0.5)`;
    ctx.font = "22px 'Share Tech Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("aegis-intelligence-v2.vercel.app", 540, 990);

  // Bug #8 fix: added all props as deps so canvas redraws whenever theme/level/
  // xp/streak changes. Previously used [] which meant the canvas never updated
  // if the component was closed and reopened with a different companion.
  }, [name, level, xp, streak, companionName, accent, accentRgb, theme]);

  function roundRect(ctx: CanvasRenderingContext2D, x:number,y:number,w:number,h:number,r:number) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
    ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
    ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
    ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
  }

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `aegis-${name}-level${level}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], "aegis-progress.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Aegis Intelligence Progress", text: `Level ${level} · ${streak} day streak · ${xp} XP` });
          return;
        }
      }
      handleDownload();
    });
  };

  const isEva = theme === "eva";
  const isSpark = theme === "spark";
  const font = isEva ? "'Share Tech Mono',monospace" : isSpark ? "'Bubblegum Sans',cursive" : "'Fredoka',sans-serif";

  return (
    <div style={{position:"fixed",inset:0,zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.7)",backdropFilter:"blur(8px)"}}>
      <div style={{background:isEva?"rgba(0,0,0,.95)":"rgba(255,255,255,.97)",borderRadius:isEva?"12px":"28px",border:`2px solid rgba(${accentRgb},.4)`,padding:"24px",width:"min(380px,92vw)",display:"flex",flexDirection:"column",alignItems:"center",gap:"16px"}}>
        <div style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:font,fontSize:isEva?"10px":"16px",fontWeight:700,color:accent,textTransform:isEva?"uppercase":"none",letterSpacing:isEva?".2em":"0"}}>
            {isEva?"PROGRESS_CARD":isSpark?"✨ Share Card!!":"📊 Share Your Progress"}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:"18px",opacity:.5}}>✕</button>
        </div>
        {/* Preview */}
        <div style={{width:"100%",borderRadius:"12px",overflow:"hidden",border:`1px solid rgba(${accentRgb},.3)`}}>
          <canvas ref={canvasRef} style={{width:"100%",height:"auto",display:"block"}}/>
        </div>
        {/* Buttons */}
        <div style={{display:"flex",gap:"10px",width:"100%"}}>
          <button onClick={handleDownload} style={{flex:1,padding:"12px",borderRadius:isEva?"4px":"16px",border:`1px solid rgba(${accentRgb},.3)`,background:`rgba(${accentRgb},.08)`,color:accent,fontFamily:font,fontSize:isEva?"10px":"13px",cursor:"pointer",textTransform:isEva?"uppercase":"none",letterSpacing:isEva?".12em":"0"}}>
            {isEva?"DOWNLOAD":isSpark?"💾 SAVE!!":"💾 Save"}
          </button>
          <button onClick={handleShare} style={{flex:1,padding:"12px",borderRadius:isEva?"4px":"16px",border:"none",background:accent,color:"#000",fontFamily:font,fontSize:isEva?"10px":"13px",fontWeight:700,cursor:"pointer",textTransform:isEva?"uppercase":"none",letterSpacing:isEva?".12em":"0"}}>
            {isEva?"SHARE":isSpark?"📤 SHARE!! 🌟":"📤 Share"}
          </button>
        </div>
        <div style={{fontFamily:"monospace",fontSize:"9px",opacity:.3,textAlign:"center"}}>
          {isSpark?"Optimized for Instagram!! ✨":"Optimized for Instagram (1080×1080)"}
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState } from "react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  accent: string;
  accentRgb: string;
  companionName: string;
  userName: string;
  userEmail: string;
  avatarUrl?: string;
  level: number;
  xp: number;
  streak: number;
  tasks: any[];
  messages: any[];
  pokeCount: number;
  xpPct: number;
  notifStatus: string;
  onRequestNotif: () => void;
  onGoals: () => void;
  onHistory: () => void;
  onWipe: () => void;
  onSignOut: () => void;
  onAvatarClick: () => void;
  onEditName: () => void;
  onPomodoro: () => void;
  onShareCard: () => void;
  onToggleSound: () => void;
  soundOn: boolean;
  quotaRemaining: number | null;
  companions: any[];
  activeCompanionId: string;
  onSwitchCompanion: (c: any) => void;
  editingName: boolean;
  nameInput: string;
  onNameInput: (v: string) => void;
  onSaveName: () => void;
  avatarUploading: boolean;
  soundThemeDesc: string;
}

type Section = "main" | "profile" | "goals" | "history" | "about";

export default function MobileDrawer({
  isOpen, onClose, theme, accent, accentRgb,
  companionName, userName, userEmail, avatarUrl,
  level, xp, streak, tasks, messages, pokeCount, xpPct,
  notifStatus, onRequestNotif,
  onGoals, onHistory, onWipe, onSignOut, onAvatarClick, onEditName,
  onPomodoro, onShareCard, onToggleSound, soundOn, quotaRemaining,
  companions, activeCompanionId, onSwitchCompanion,
  editingName, nameInput, onNameInput, onSaveName, avatarUploading,
  soundThemeDesc,
}: DrawerProps) {
  const [section, setSection] = useState<Section>("main");
  const isEva = theme === "eva";
  const isSpark = theme === "spark";
  const doneTasks = tasks.filter(t => t.completed).length;

  const font = isEva ? "'Share Tech Mono',monospace" : isSpark ? "'Bubblegum Sans',cursive" : "'Fredoka',sans-serif";
  const bg = isEva ? "rgba(2,2,6,.98)" : isSpark ? "rgba(255,240,246,.98)" : "rgba(255,251,235,.98)";
  const fg = isEva ? "rgba(255,255,255,.85)" : "#1F2937";
  const borderColor = `rgba(${accentRgb},.2)`;
  const mutedFg = isEva ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.35)";

  const menuItem = (icon: string, label: string, onClick: () => void, danger = false) => (
    <button onClick={onClick} style={{
      display:"flex", alignItems:"center", gap:"14px",
      width:"100%", padding:"14px 20px",
      background:"none", border:"none",
      cursor:"pointer", textAlign:"left",
      borderBottom:`1px solid rgba(${accentRgb},.08)`,
      transition:"background .15s",
    }}
    onMouseEnter={e=>(e.currentTarget.style.background=`rgba(${accentRgb},.06)`)}
    onMouseLeave={e=>(e.currentTarget.style.background="none")}
    >
      <span style={{fontSize:"20px",width:"24px",textAlign:"center"}}>{icon}</span>
      <span style={{
        fontFamily:font, fontSize:isEva?"10px":"15px",
        color: danger ? "#EF4444" : accent,
        fontWeight:600, letterSpacing:isEva?".12em":"0",
        textTransform:isEva?"uppercase":"none",
      }}>{label}</span>
      <span style={{marginLeft:"auto",opacity:.3,fontSize:"14px"}}>›</span>
    </button>
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,.5)",backdropFilter:"blur(6px)"}}/>

      {/* Drawer */}
      <div style={{
        position:"fixed", top:0, right:0, bottom:0,
        width:"min(320px,92vw)",
        zIndex:201,
        background:bg,
        borderLeft:`1px solid ${borderColor}`,
        display:"flex", flexDirection:"column",
        overflowY:"hidden",
        animation:"drawer-in .3s cubic-bezier(0.23,1,0.32,1)",
      }}>
        <style>{`
          @keyframes drawer-in{from{transform:translateX(100%)}to{transform:translateX(0)}}
          @keyframes spin{to{transform:rotate(360deg)}}
          .drawer-sc::-webkit-scrollbar{display:none;}.drawer-sc{scrollbar-width:none;}
        `}</style>

        {/* ── HEADER ── */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"16px 20px",
          borderBottom:`1px solid ${borderColor}`,
          flexShrink:0,
          background:isEva?"rgba(100,116,139,.06)":"rgba(255,255,255,.5)",
        }}>
          {section !== "main" ? (
            <button onClick={()=>setSection("main")} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",color:accent,fontFamily:font,fontSize:isEva?"10px":"14px",fontWeight:600}}>
              ‹ {isEva?"BACK":"Back"}
            </button>
          ) : (
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
                <polygon points="50,4 93,27.5 93,72.5 50,96 7,72.5 7,27.5" stroke={accent} strokeWidth="3" fill="none"/>
                <circle cx="50" cy="50" r="13" stroke={accent} strokeWidth="2.5" fill="none"/>
                <circle cx="50" cy="50" r="5.5" fill={accent}/>
              </svg>
              <span style={{fontFamily:font,fontSize:isEva?"11px":"16px",fontWeight:700,color:accent,letterSpacing:isEva?".15em":"0",textTransform:isEva?"uppercase":"none"}}>
                {isEva?"AEGIS_MENU":isSpark?"AEGIS MENU!! ✨":"Aegis Menu"}
              </span>
            </div>
          )}
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:"22px",color:mutedFg,lineHeight:1}}>✕</button>
        </div>

        {/* ── CONTENT ── */}
        <div className="drawer-sc" style={{flex:1,overflowY:"auto"}}>

          {/* ══ MAIN MENU ══ */}
          {section === "main" && (
            <>
              {/* Mini profile card */}
              <div style={{
                padding:"20px",
                background:isEva?"rgba(100,116,139,.06)":`rgba(${accentRgb},.05)`,
                borderBottom:`1px solid ${borderColor}`,
                display:"flex", alignItems:"center", gap:"14px",
                cursor:"pointer",
              }} onClick={()=>setSection("profile")}>
                <div style={{position:"relative",flexShrink:0}}>
                  <div style={{width:"52px",height:"52px",borderRadius:"50%",overflow:"hidden",background:`rgba(${accentRgb},.15)`,border:`2px solid rgba(${accentRgb},.5)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {avatarUploading
                      ?<div style={{width:"20px",height:"20px",border:`2px solid rgba(${accentRgb},.3)`,borderTop:`2px solid ${accent}`,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
                      :avatarUrl?<img src={avatarUrl} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      :<span style={{fontSize:"24px"}}>👤</span>}
                  </div>
                  <div style={{position:"absolute",bottom:0,right:0,width:"10px",height:"10px",borderRadius:"50%",background:accent,boxShadow:`0 0 6px rgba(${accentRgb},.9)`}}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:font,fontSize:"16px",fontWeight:700,color:accent,marginBottom:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{userName||"AGENT"}</div>
                  <div style={{fontFamily:"monospace",fontSize:"10px",color:mutedFg,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{userEmail}</div>
                  <div style={{display:"flex",gap:"8px",marginTop:"4px"}}>
                    <span style={{fontFamily:"monospace",fontSize:"9px",padding:"2px 6px",borderRadius:"8px",background:`rgba(${accentRgb},.1)`,color:accent}}>LVL {level}</span>
                    <span style={{fontFamily:"monospace",fontSize:"9px",padding:"2px 6px",borderRadius:"8px",background:`rgba(${accentRgb},.1)`,color:accent}}>{streak}🔥</span>
                  </div>
                </div>
                <span style={{opacity:.3,fontSize:"18px",color:fg}}>›</span>
              </div>

              {/* Menu items */}
              <div style={{paddingTop:"8px"}}>
                {menuItem("🎯", isEva?"OBJECTIVES":isSpark?"Goals!! 🎯":"My Goals", ()=>{onGoals();onClose();})}
                {menuItem("💬", isEva?"SYNC_LOGS":isSpark?"History!! 💬":"Chat History", ()=>{onHistory();onClose();})}
                {menuItem("🍅", isEva?"POMODORO_TIMER":isSpark?"Pomodoro!! 🍅":"Pomodoro Timer", ()=>{onPomodoro();onClose();})}
                {menuItem("📊", isEva?"PROGRESS_CARD":isSpark?"Share Card!! 📊":"Share Progress", ()=>{onShareCard();onClose();})}
                {menuItem(soundOn?"🔇":"🎵", isEva?"SOUND_THEME":isSpark?`${soundOn?"Mute":"Sound"} 🎵`:`${soundOn?"Mute":"Sound Theme"}`, ()=>{onToggleSound();onClose();})}
                {menuItem("ℹ️", isEva?"ABOUT_AEGIS":isSpark?"About!! ℹ️":"About Aegis", ()=>setSection("about"))}
                {menuItem("🗑️", isEva?"WIPE_HISTORY":isSpark?"Wipe Chats!! 🗑️":"Wipe Chat", ()=>{onWipe();onClose();}, false)}
                {menuItem("⏻", isEva?"TERMINATE_SESSION":isSpark?"Sign Out!! 👋":"Sign Out", ()=>{onSignOut();}, true)}
              </div>

              {/* Notif opt-in */}
              {notifStatus !== "granted" && notifStatus !== "denied" && (
                <div style={{margin:"16px",padding:"14px",borderRadius:"12px",background:`rgba(${accentRgb},.08)`,border:`1px solid rgba(${accentRgb},.25)`}}>
                  <div style={{fontFamily:font,fontSize:isEva?"9px":"13px",fontWeight:600,color:accent,marginBottom:"6px",textTransform:isEva?"uppercase":"none",letterSpacing:isEva?".12em":"0"}}>
                    {isEva?"ENABLE_NOTIFICATIONS":isSpark?"Get Notified!! 🔔":"Daily Reminders 🔔"}
                  </div>
                  <div style={{fontFamily:"monospace",fontSize:"10px",color:mutedFg,marginBottom:"10px",lineHeight:1.5}}>
                    {isSpark?"Spark will remind you every day!! 💖":isEva?"Receive daily check-in alerts from your companion.":"Get daily check-ins from your companion!"}
                  </div>
                  <button onClick={onRequestNotif} style={{background:accent,color:"#000",border:"none",borderRadius:isEva?"3px":"20px",padding:"8px 18px",fontFamily:font,fontSize:isEva?"9px":"12px",fontWeight:700,cursor:"pointer",textTransform:isEva?"uppercase":"none",letterSpacing:isEva?".12em":"0"}}>
                    {isEva?"ENABLE":isSpark?"YES!! ENABLE!! 🎉":"Enable Notifications"}
                  </button>
                </div>
              )}
              {notifStatus === "granted" && (
                <div style={{margin:"16px",padding:"10px 14px",borderRadius:"10px",background:"rgba(34,197,94,.08)",border:"1px solid rgba(34,197,94,.25)",fontFamily:"monospace",fontSize:"10px",color:"#86EFAC",display:"flex",alignItems:"center",gap:"8px"}}>
                  <span>✅</span> {isEva?"NOTIFICATIONS_ACTIVE":"Notifications enabled!"}
                </div>
              )}
            </>
          )}

          {/* ══ PROFILE SECTION ══ */}
          {section === "profile" && (
            <div style={{padding:"20px",display:"flex",flexDirection:"column",alignItems:"center",gap:"14px"}}>
              {/* Avatar */}
              <div style={{position:"relative",cursor:"pointer"}} onClick={onAvatarClick}>
                <div style={{width:"88px",height:"88px",borderRadius:"50%",overflow:"hidden",background:`rgba(${accentRgb},.12)`,border:`3px solid rgba(${accentRgb},.5)`,boxShadow:`0 0 20px rgba(${accentRgb},.25)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {avatarUrl?<img src={avatarUrl} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:"38px"}}>👤</span>}
                </div>
                <div style={{position:"absolute",bottom:2,right:2,background:accent,borderRadius:"50%",width:"22px",height:"22px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",border:`2px solid ${bg}`}}>📷</div>
              </div>
              <div style={{fontFamily:"monospace",fontSize:"9px",color:mutedFg}}>Tap to change photo</div>

              {/* Name edit */}
              {editingName ? (
                <div style={{width:"100%",display:"flex",gap:"8px",alignItems:"center"}}>
                  <input value={nameInput} onChange={e=>onNameInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")onSaveName();}}
                    style={{flex:1,background:"transparent",border:"none",borderBottom:`2px solid ${accent}`,outline:"none",fontFamily:font,fontSize:"18px",fontWeight:700,textAlign:"center",padding:"4px",color:isEva?"white":"#1F2937"}}
                    autoFocus/>
                  <button onClick={onSaveName} style={{background:accent,color:"#000",border:"none",borderRadius:"8px",padding:"8px 14px",fontFamily:font,fontSize:"13px",fontWeight:700,cursor:"pointer"}}>✓</button>
                </div>
              ) : (
                <div style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer"}} onClick={onEditName}>
                  <div style={{fontFamily:font,fontSize:"22px",fontWeight:700,color:accent}}>{userName||"AGENT"}</div>
                  <span style={{fontSize:"14px",opacity:.4}}>✏️</span>
                </div>
              )}
              <div style={{fontFamily:"monospace",fontSize:"11px",color:mutedFg,textAlign:"center",wordBreak:"break-all"}}>{userEmail}</div>

              {/* XP bar */}
              <div style={{width:"100%"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                  <span style={{fontFamily:"monospace",fontSize:"11px",color:accent}}>Level {level}</span>
                  <span style={{fontFamily:"monospace",fontSize:"10px",color:mutedFg}}>{xp} XP</span>
                </div>
                <div style={{background:`rgba(${accentRgb},.15)`,borderRadius:"10px",height:"8px",overflow:"hidden"}}>
                  <div style={{background:accent,width:`${xpPct}%`,height:"100%",borderRadius:"10px",transition:"width .8s"}}/>
                </div>
              </div>

              {/* Stats */}
              <div style={{width:"100%",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
                {[{l:"Level",v:level},{l:"Streak",v:`${streak}🔥`},{l:"Tasks",v:`${doneTasks}/${tasks.length}`},{l:"Pokes",v:pokeCount},{l:"Msgs",v:messages.length},{l:"XP",v:xp}].map((s,i)=>(
                  <div key={i} style={{background:`rgba(${accentRgb},.08)`,borderRadius:"12px",border:`1px solid rgba(${accentRgb},.18)`,padding:"10px 8px",textAlign:"center"}}>
                    <div style={{fontFamily:"monospace",fontSize:"9px",color:mutedFg,textTransform:"uppercase",marginBottom:"4px"}}>{s.l}</div>
                    <div style={{fontFamily:font,fontSize:"15px",fontWeight:700,color:accent}}>{s.v}</div>
                  </div>
                ))}
              </div>

              {/* Companion selector */}
              <div style={{width:"100%",padding:"14px",background:`rgba(${accentRgb},.06)`,borderRadius:"14px",border:`1px solid rgba(${accentRgb},.18)`}}>
                <div style={{fontFamily:"monospace",fontSize:"9px",color:mutedFg,textTransform:"uppercase",marginBottom:"10px",letterSpacing:".1em"}}>Default Companion</div>
                <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                  {companions.map(c=>{
                    const isActive=c.id===activeCompanionId;
                    return(
                      <button key={c.id} onClick={()=>onSwitchCompanion(c)} style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 14px",borderRadius:"12px",border:`2px solid ${isActive?c.accent:`rgba(${accentRgb},.15)`}`,background:isActive?`rgba(${c.accentRgb},.1)`:"transparent",cursor:"pointer",textAlign:"left",width:"100%",transition:"all .2s"}}>
                        <div style={{width:"32px",height:"32px",borderRadius:"50%",background:c.bgColor,flexShrink:0,boxShadow:isActive?`0 0 10px rgba(${c.accentRgb},.6)`:undefined}}/>
                        <div>
                          <div style={{fontFamily:font,fontSize:"14px",fontWeight:700,color:c.accent}}>{c.name}</div>
                          <div style={{fontFamily:"monospace",fontSize:"9px",color:mutedFg,marginTop:"1px"}}>{c.label}</div>
                        </div>
                        {isActive&&<div style={{marginLeft:"auto",width:"8px",height:"8px",borderRadius:"50%",background:c.accent,boxShadow:`0 0 6px rgba(${c.accentRgb},.8)`}}/>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {quotaRemaining!==null&&(
                <div style={{width:"100%",padding:"10px 14px",borderRadius:"10px",background:quotaRemaining<1500?"rgba(239,68,68,.08)":"rgba(34,197,94,.06)",border:`1px solid ${quotaRemaining<1500?"rgba(239,68,68,.3)":"rgba(34,197,94,.25)"}`}}>
                  <div style={{fontFamily:"monospace",fontSize:"8px",color:mutedFg,textTransform:"uppercase",marginBottom:"3px"}}>Voice Quota</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:"12px",color:quotaRemaining<1500?"#FCA5A5":"#86EFAC"}}>{quotaRemaining.toLocaleString()} chars remaining</div>
                </div>
              )}
            </div>
          )}

          {/* ══ ABOUT SECTION ══ */}
          {section === "about" && (
            <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:"16px"}}>
              {/* Logo */}
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"12px",padding:"20px",background:`rgba(${accentRgb},.06)`,borderRadius:"16px",border:`1px solid rgba(${accentRgb},.18)`}}>
                <svg width="64" height="64" viewBox="0 0 100 100" fill="none">
                  <polygon points="50,4 93,27.5 93,72.5 50,96 7,72.5 7,27.5" stroke={accent} strokeWidth="2.5" fill="none" opacity="0.9"/>
                  <polygon points="50,16 82,33.5 82,66.5 50,84 18,66.5 18,33.5" stroke={accent} strokeWidth="1" fill="none" opacity="0.3"/>
                  <circle cx="50" cy="50" r="14" stroke={accent} strokeWidth="2" fill="none"/>
                  <circle cx="50" cy="50" r="6" fill={accent}/>
                  <circle cx="50" cy="50" r="3" fill="white" opacity="0.8"/>
                </svg>
                <div style={{fontFamily:font,fontSize:isEva?"14px":"20px",fontWeight:700,color:accent,letterSpacing:isEva?".2em":"0",textTransform:isEva?"uppercase":"none",textAlign:"center"}}>
                  {isEva?"AEGIS_INTELLIGENCE":isSpark?"AEGIS INTELLIGENCE!! ✨":"Aegis Intelligence"}
                </div>
                <div style={{fontFamily:"monospace",fontSize:"10px",color:mutedFg,textAlign:"center"}}>Version 2.0 · Built with 💛</div>
              </div>

              {/* Description */}
              <div style={{fontFamily:isEva?"'Rajdhani',sans-serif":font,fontSize:"14px",color:fg,lineHeight:1.7,opacity:.8}}>
                {isEva
                  ?"Aegis Intelligence is a full-stack AI companion platform engineered for productivity and goal achievement. Three distinct AI entities — Squish, Eva, and Spark — provide personalized support, real-time voice interaction, and adaptive motivation."
                  :isSpark
                  ?"OMG so Aegis Intelligence is like your BEST FRIEND that's also an AI!! 🎉 You get THREE amazing companions who help you with EVERYTHING!! Goals, studying, motivation — we do it ALL!! 🌈💖"
                  :"Aegis Intelligence is your personal AI companion for productivity, goals, and daily motivation. Choose from three unique companions — each with their own personality, voice, and style — to make your journey more engaging and fun! 💛"}
              </div>

              {/* Tech stack */}
              <div style={{background:`rgba(${accentRgb},.06)`,borderRadius:"12px",border:`1px solid rgba(${accentRgb},.15)`,padding:"14px"}}>
                <div style={{fontFamily:"monospace",fontSize:"9px",color:accent,textTransform:"uppercase",letterSpacing:".12em",marginBottom:"10px"}}>Tech Stack</div>
                {[
                  ["⚡","Frontend","Next.js 16 + TypeScript"],
                  ["🎨","3D Engine","Three.js + React Three Fiber"],
                  ["🗄️","Database","Supabase (PostgreSQL)"],
                  ["🤖","AI Brain","Groq (Llama 3)"],
                  ["🎙️","Voice","ElevenLabs TTS"],
                  ["🚀","Deploy","Vercel"],
                ].map(([icon,label,tech],i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:"10px",padding:"6px 0",borderBottom:`1px solid rgba(${accentRgb},.06)`}}>
                    <span style={{fontSize:"16px",width:"20px",textAlign:"center"}}>{icon}</span>
                    <span style={{fontFamily:"monospace",fontSize:"10px",color:mutedFg,width:"70px",flexShrink:0}}>{label}</span>
                    <span style={{fontFamily:font,fontSize:"12px",color:fg,opacity:.8}}>{tech}</span>
                  </div>
                ))}
              </div>

              {/* Companions */}
              <div style={{background:`rgba(${accentRgb},.06)`,borderRadius:"12px",border:`1px solid rgba(${accentRgb},.15)`,padding:"14px"}}>
                <div style={{fontFamily:"monospace",fontSize:"9px",color:accent,textTransform:"uppercase",letterSpacing:".12em",marginBottom:"10px"}}>Meet the Companions</div>
                {[
                  {id:"squish",name:"Squish",color:"#FBBF24",desc:"Warm & friendly. Perfect for day-to-day support and motivation."},
                  {id:"eva",name:"Eva",color:"#64748B",desc:"Precise & technical. Best for coding, planning, and analysis."},
                  {id:"spark",name:"Spark",color:"#EC4899",desc:"Hyper & energetic. Ideal for brainstorming and creative sessions."},
                ].map((c,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"10px",padding:"8px 0",borderBottom:`1px solid rgba(${accentRgb},.06)`}}>
                    <div style={{width:"28px",height:"28px",borderRadius:"50%",background:c.color,flexShrink:0,marginTop:"2px"}}/>
                    <div>
                      <div style={{fontFamily:font,fontSize:"13px",fontWeight:700,color:c.color,marginBottom:"2px"}}>{c.name}</div>
                      <div style={{fontFamily:"monospace",fontSize:"10px",color:mutedFg,lineHeight:1.5}}>{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Links */}
              <div style={{display:"flex",gap:"8px"}}>
                <a href="https://aegis-intelligence-v2.vercel.app" target="_blank" rel="noopener" style={{flex:1,padding:"10px",textAlign:"center",borderRadius:"10px",background:`rgba(${accentRgb},.1)`,border:`1px solid rgba(${accentRgb},.25)`,color:accent,fontFamily:"monospace",fontSize:"10px",textDecoration:"none",textTransform:"uppercase",letterSpacing:".1em"}}>🌐 Website</a>
              </div>

              <div style={{fontFamily:"monospace",fontSize:"9px",color:mutedFg,textAlign:"center",lineHeight:1.6}}>
                Built with ❤️ for productivity &amp; creativity.<br/>
                © 2026 Aegis Intelligence · All rights reserved.
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
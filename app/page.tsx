"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "../lib/supabase";
import Companion3D from "../components/Companion3D";
import Auth from "../components/Auth";
import AppDownloadBanner from "../components/AppDownloadBanner";

// ─── COMPANIONS ───────────────────────────────────────────────────────────────
const COMPANIONS = [
  {
    id: "squish", name: "Squish",
    bgColor: "#FBBF24", // actual color value (no Tailwind)
    accent: "#F59E0B", accentRgb: "245,158,11",
    voiceId: "DXFkLCBUTmvXpp2QwZjA",
    label: "FRIENDLY_UNIT", status: "HELPFUL MODE", theme: "squish",
    // Voice wake words — saying any of these activates the companion
    wakeWords: ["hey squish", "squish", "wake up"],
    greeting: (name: string) =>
      `Hey ${name}! 💛 Squish is here and ready to help. What are we working on today?`,
    moodKeywords: {
      stressed: ["Hey breathe! You got this 💛", "One step at a time~", "Let's tackle this together! 🤗"],
      happy:    ["Yay! I love your energy! ✨", "Let's gooo! 🎉", "Squishing with joy!"],
      focused:  ["Locked in! Let's crush it! 🎯", "Focus mode: ON 🔥", "You're in the zone!"],
    },
  },
  {
    id: "eva", name: "Eva",
    bgColor: "#64748B",
    accent: "#64748B", accentRgb: "100,116,139",
    voiceId: "WeA4Q36twV5kwSaTEL0Q",
    label: "TECH_CORE", status: "ANALYTICAL MODE", theme: "eva",
    wakeWords: ["hey eva", "eva", "wake up", "aegis online"],
    greeting: (name: string) =>
      `AEGIS_ONLINE. Agent ${name} detected. All systems nominal. Awaiting your command.`,
    moodKeywords: {
      stressed: ["Recalibrating. Stress detected. Initiating calm protocols.", "Suggest task decomposition."],
      happy:    ["Positive sentiment logged. Optimal performance state active.", "Morale coefficient: high."],
      focused:  ["Deep focus mode engaged. Noise suppression: active.", "Concentration matrix: optimal."],
    },
  },
  {
    id: "spark", name: "Spark",
    bgColor: "#EC4899",
    accent: "#EC4899", accentRgb: "236,72,153",
    voiceId: "rnaFpqVpBnt4nZq1fII4",
    label: "MOTIVATOR", status: "HYPERDRIVE MODE", theme: "spark",
    wakeWords: ["hey spark", "spark", "wake up", "let's go"],
    greeting: (name: string) =>
      `OMG ${name}!! 🎉✨ SPARK IS HERE AND WE ARE GOING TO HAVE THE BEST DAY EVER!! What's the plan?! 🚀💖`,
    moodKeywords: {
      stressed: ["NOOO don't stress!! You're AMAZING!! 🌟💖", "Spark believes in you SO MUCH!! ✨"],
      happy:    ["OMG YESSS!! 🎉🎊 BEST DAY EVER!!!", "WOOHOOO!! WE'RE THRIVING!! 🌈✨💥"],
      focused:  ["LETS. GO. 🔥🔥🔥 HYPERFOCUS ACTIVATED!!", "CONCENTRATION LEVEL: MAXIMUM!! 🚀💫"],
    },
  },
];

type Mood = "stressed" | "happy" | "focused" | "neutral";

function detectMood(text: string): Mood {
  const l = text.toLowerCase();
  if (/stress|overwhelm|tired|exhaust|anxious|can't|stuck|panic|fail|hard/.test(l)) return "stressed";
  if (/happy|great|awesome|yay|love|excit|amazing|good|yes|wow|thanks/.test(l)) return "happy";
  if (/focus|work|study|code|build|create|task|goal|deadline|project/.test(l)) return "focused";
  return "neutral";
}

function playSound(type: "click"|"send"|"poke"|"levelup"|"switch"|"briefing", theme: string) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type==="click")    { osc.type="sine";     osc.frequency.setValueAtTime(440,now); g.gain.setValueAtTime(.04,now); }
    if (type==="send")     { osc.type="sine";     osc.frequency.setValueAtTime(theme==="spark"?1046:theme==="eva"?660:880,now); g.gain.setValueAtTime(.06,now); }
    if (type==="poke")     { osc.type="triangle"; osc.frequency.setValueAtTime(300,now); osc.frequency.exponentialRampToValueAtTime(150,now+.15); g.gain.setValueAtTime(.08,now); }
    if (type==="switch")   { osc.type="sine";     osc.frequency.setValueAtTime(660,now); osc.frequency.setValueAtTime(880,now+.08); g.gain.setValueAtTime(.06,now); }
    if (type==="briefing") { osc.type="sine";     osc.frequency.setValueAtTime(523,now); osc.frequency.setValueAtTime(659,now+.12); g.gain.setValueAtTime(.08,now); }
    if (type==="levelup")  { osc.type="sine"; [523,659,784,1046].forEach((f,i)=>osc.frequency.setValueAtTime(f,now+i*.1)); g.gain.setValueAtTime(.12,now); }
    g.gain.exponentialRampToValueAtTime(.001, now+.35);
    osc.start(now); osc.stop(now+.35);
  } catch(_) {}
}

const getLevelFromXP = (xp: number) => Math.floor(Math.pow(xp/80,.6))+1;
const getXPForLevel  = (l: number) => Math.ceil(Math.pow(l-1,1.667)*80);

interface Task    { id: string; text: string; category: string; completed: boolean; }
interface Profile { full_name: string; persona: string; objective: string; avatar_url?: string; }

// ─── THEME STYLES (all inline — no Tailwind dynamic classes) ─────────────────
const T = {
  squish: {
    bg:         "linear-gradient(145deg,#FFFBEB 0%,#FEF3C7 55%,#FDE68A 100%)",
    font:       "'Fredoka', sans-serif",
    card:       { background:"rgba(255,255,255,.9)", borderRadius:"24px", border:"2px solid rgba(245,158,11,.25)", boxShadow:"0 6px 30px rgba(245,158,11,.12)", backdropFilter:"blur(16px)" },
    ibar:       { background:"rgba(255,255,255,.94)", borderRadius:"50px", border:"2px solid rgba(245,158,11,.35)", boxShadow:"0 4px 20px rgba(245,158,11,.1)" },
    sbar:       { background:"rgba(255,251,235,.92)", borderBottom:"1.5px solid rgba(245,158,11,.2)" },
    panel:      { background:"rgba(255,251,235,.98)", borderRight:"1px solid rgba(245,158,11,.2)" },
    panelRight: { background:"rgba(255,251,235,.98)", borderLeft:"1px solid rgba(245,158,11,.2)" },
    btnBase:    { background:"rgba(255,255,255,.78)", border:"2px solid rgba(245,158,11,.3)", color:"#92400E", borderRadius:"50px", fontFamily:"'Fredoka',sans-serif", fontWeight:"600", fontSize:"13px" },
    btnRed:     { background:"rgba(255,255,255,.78)", border:"2px solid rgba(220,38,38,.3)", color:"#DC2626", borderRadius:"50px", fontFamily:"'Fredoka',sans-serif", fontWeight:"600", fontSize:"13px" },
    sbtn:       { background:"#F59E0B", color:"white", border:"none", borderRadius:"40px", fontFamily:"'Fredoka',sans-serif", fontWeight:"700", fontSize:"13px", boxShadow:"0 4px 12px rgba(245,158,11,.35)" },
    txtMain:    { fontFamily:"'Fredoka',sans-serif", fontSize:"15px", fontWeight:"500", color:"#374151", textAlign:"center" as const, lineHeight:"1.6" },
    stxt:       { fontFamily:"'Fredoka',sans-serif", fontSize:"12px", color:"rgba(120,53,15,.55)" },
    ptitle:     { fontFamily:"'Fredoka',sans-serif", fontSize:"20px", fontWeight:"700", color:"#92400E" },
    chip:       { background:"rgba(255,255,255,.82)", borderRadius:"20px", border:"1.5px solid rgba(245,158,11,.25)" },
    chipL:      { fontFamily:"'Fredoka',sans-serif", fontSize:"10px", color:"rgba(120,53,15,.45)" },
    chipV:      { fontFamily:"'Fredoka',sans-serif", fontSize:"13px", fontWeight:"600", color:"#92400E" },
    muser:      { background:"rgba(245,158,11,.1)", border:"1px solid rgba(245,158,11,.2)", borderRadius:"14px" },
    mbot:       { background:"white", border:"1px solid rgba(245,158,11,.12)", borderRadius:"14px" },
    aura:       "radial-gradient(ellipse,rgba(245,158,11,.16) 0%,transparent 70%)",
    xpbg:       { background:"rgba(245,158,11,.15)", borderRadius:"10px", height:"5px" },
    xpfg:       { background:"linear-gradient(90deg,#F59E0B,#FCD34D)" },
    dot:        { background:"#F59E0B", boxShadow:"0 0 8px rgba(245,158,11,.9)" },
    inp:        { fontFamily:"'Fredoka',sans-serif", fontSize:"14px", color:"#78350F" },
    ph:         "rgba(120,53,15,.32)",
    mic:        { background:"rgba(245,158,11,.1)", border:"2px solid rgba(245,158,11,.3)" },
    taskInp:    { color:"#78350F", borderBottomColor:"rgba(245,158,11,.4)", fontFamily:"'Fredoka',sans-serif" },
    nameEdit:   { color:"#92400E", borderBottomColor:"#F59E0B", fontFamily:"'Fredoka',sans-serif" },
    compBox:    { background:"rgba(255,255,255,.65)", border:"1px solid rgba(245,158,11,.2)", backdropFilter:"blur(10px)" },
  },
  spark: {
    bg:         "linear-gradient(135deg,#FFF0F6 0%,#FCE4EC 50%,#F8BBD0 100%)",
    font:       "'Bubblegum Sans', cursive",
    card:       { background:"rgba(255,255,255,.92)", borderRadius:"24px", border:"2.5px solid rgba(236,72,153,.3)", boxShadow:"3px 3px 0 rgba(236,72,153,.18),0 6px 24px rgba(236,72,153,.1)", backdropFilter:"blur(16px)" },
    ibar:       { background:"rgba(255,255,255,.94)", borderRadius:"22px", border:"2px solid rgba(236,72,153,.45)", boxShadow:"3px 3px 0 rgba(236,72,153,.18)" },
    sbar:       { background:"rgba(255,240,246,.92)", borderBottom:"1.5px solid rgba(236,72,153,.2)" },
    panel:      { background:"rgba(255,240,246,.98)", borderRight:"1px solid rgba(236,72,153,.2)" },
    panelRight: { background:"rgba(255,240,246,.98)", borderLeft:"1px solid rgba(236,72,153,.2)" },
    btnBase:    { background:"rgba(255,255,255,.8)", border:"2px solid rgba(236,72,153,.35)", color:"#9D174D", borderRadius:"16px", fontFamily:"'Bubblegum Sans',cursive", fontWeight:"400", fontSize:"13px" },
    btnRed:     { background:"rgba(255,255,255,.8)", border:"2px solid rgba(220,38,38,.3)", color:"#DC2626", borderRadius:"16px", fontFamily:"'Bubblegum Sans',cursive", fontWeight:"400", fontSize:"13px" },
    sbtn:       { background:"linear-gradient(135deg,#EC4899,#F472B6)", color:"white", border:"none", borderRadius:"16px", fontFamily:"'Bubblegum Sans',cursive", fontWeight:"400", fontSize:"13px", boxShadow:"2px 2px 0 rgba(236,72,153,.3)" },
    txtMain:    { fontFamily:"'Bubblegum Sans',cursive", fontSize:"16px", fontWeight:"400", color:"#374151", textAlign:"center" as const, lineHeight:"1.6" },
    stxt:       { fontFamily:"'Bubblegum Sans',cursive", fontSize:"12px", color:"rgba(157,23,77,.6)" },
    ptitle:     { fontFamily:"'Bubblegum Sans',cursive", fontSize:"20px", fontWeight:"400", color:"#9D174D" },
    chip:       { background:"rgba(255,255,255,.84)", borderRadius:"14px", border:"1.5px solid rgba(236,72,153,.22)" },
    chipL:      { fontFamily:"'Bubblegum Sans',cursive", fontSize:"10px", color:"rgba(157,23,77,.5)" },
    chipV:      { fontFamily:"'Bubblegum Sans',cursive", fontSize:"13px", fontWeight:"400", color:"#9D174D" },
    muser:      { background:"rgba(236,72,153,.08)", border:"1px solid rgba(236,72,153,.2)", borderRadius:"14px" },
    mbot:       { background:"white", border:"1px solid rgba(236,72,153,.15)", borderRadius:"14px" },
    aura:       "radial-gradient(ellipse,rgba(236,72,153,.14) 0%,transparent 70%)",
    xpbg:       { background:"rgba(236,72,153,.12)", borderRadius:"10px", height:"5px" },
    xpfg:       { background:"linear-gradient(90deg,#EC4899,#F472B6,#FB7185)" },
    dot:        { background:"#EC4899", boxShadow:"0 0 8px rgba(236,72,153,1)" },
    inp:        { fontFamily:"'Bubblegum Sans',cursive", fontSize:"14px", color:"#831843" },
    ph:         "rgba(131,24,67,.3)",
    mic:        { background:"rgba(236,72,153,.1)", border:"2px solid rgba(236,72,153,.35)" },
    taskInp:    { color:"#831843", borderBottomColor:"rgba(236,72,153,.4)", fontFamily:"'Bubblegum Sans',cursive" },
    nameEdit:   { color:"#9D174D", borderBottomColor:"#EC4899", fontFamily:"'Bubblegum Sans',cursive" },
    compBox:    { background:"rgba(255,255,255,.65)", border:"1px solid rgba(236,72,153,.2)", backdropFilter:"blur(10px)" },
  },
  eva: {
    bg:         "#050508",
    font:       "'Rajdhani', sans-serif",
    card:       { background:"rgba(0,0,0,.8)", borderRadius:"12px", border:"1px solid rgba(100,116,139,.22)", boxShadow:"0 0 30px rgba(100,116,139,.07)", backdropFilter:"blur(20px)" },
    ibar:       { background:"rgba(0,0,0,.88)", borderRadius:"8px", border:"1px solid rgba(100,116,139,.3)" },
    sbar:       { background:"rgba(100,116,139,.05)", borderBottom:"1px solid rgba(100,116,139,.18)" },
    panel:      { background:"rgba(2,2,6,.97)", borderRight:"1px solid rgba(100,116,139,.18)" },
    panelRight: { background:"rgba(2,2,6,.97)", borderLeft:"1px solid rgba(100,116,139,.18)" },
    btnBase:    { background:"rgba(255,255,255,.04)", border:"1px solid rgba(100,116,139,.28)", color:"rgba(255,255,255,.45)", borderRadius:"3px", fontFamily:"'Share Tech Mono',monospace", fontWeight:"700", fontSize:"9px", letterSpacing:".15em", textTransform:"uppercase" as const },
    btnRed:     { background:"rgba(255,255,255,.04)", border:"1px solid rgba(239,68,68,.2)", color:"rgba(239,68,68,.6)", borderRadius:"3px", fontFamily:"'Share Tech Mono',monospace", fontWeight:"700", fontSize:"9px", letterSpacing:".15em", textTransform:"uppercase" as const },
    sbtn:       { background:"#475569", color:"white", border:"none", borderRadius:"4px", fontFamily:"'Share Tech Mono',monospace", fontWeight:"700", fontSize:"9px", letterSpacing:".15em", textTransform:"uppercase" as const, clipPath:"polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)" },
    txtMain:    { fontFamily:"'Rajdhani',sans-serif", fontSize:"14px", fontWeight:"400", color:"rgba(255,255,255,.82)", textAlign:"left" as const, lineHeight:"1.65", letterSpacing:".02em" },
    stxt:       { fontFamily:"'Share Tech Mono',monospace", fontSize:"8px", color:"rgba(100,116,139,.7)", letterSpacing:".15em", textTransform:"uppercase" as const },
    ptitle:     { fontFamily:"'Share Tech Mono',monospace", fontSize:"11px", fontWeight:"700", color:"#64748B", letterSpacing:".2em", textTransform:"uppercase" as const },
    chip:       { background:"rgba(100,116,139,.06)", borderRadius:"3px", border:"1px solid rgba(100,116,139,.18)" },
    chipL:      { fontFamily:"'Share Tech Mono',monospace", fontSize:"7px", color:"rgba(255,255,255,.22)", letterSpacing:".12em" },
    chipV:      { fontFamily:"'Share Tech Mono',monospace", fontSize:"10px", fontWeight:"400", color:"#94A3B8" },
    muser:      { background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.05)", borderRadius:"6px" },
    mbot:       { background:"rgba(100,116,139,.05)", border:"1px solid rgba(100,116,139,.12)", borderRadius:"6px" },
    aura:       "radial-gradient(ellipse,rgba(100,116,139,.1) 0%,transparent 70%)",
    xpbg:       { background:"rgba(100,116,139,.1)", borderRadius:"2px", height:"3px" },
    xpfg:       { background:"linear-gradient(90deg,#475569,#94A3B8)" },
    dot:        { background:"#64748B", boxShadow:"0 0 8px rgba(100,116,139,.9)" },
    inp:        { fontFamily:"'Rajdhani',sans-serif", fontSize:"14px", color:"white", letterSpacing:".04em" },
    ph:         "rgba(255,255,255,.18)",
    mic:        { background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.12)" },
    taskInp:    { color:"white", borderBottomColor:"rgba(100,116,139,.4)", fontFamily:"'Share Tech Mono',monospace", fontSize:"11px" },
    nameEdit:   { color:"white", borderBottomColor:"#64748B", fontFamily:"'Share Tech Mono',monospace" },
    compBox:    { background:"rgba(0,0,0,.65)", border:"1px solid rgba(100,116,139,.2)", backdropFilter:"blur(10px)" },
  },
};

export default function Home() {
  const [session, setSession]               = useState<any>(null);
  const [authLoading, setAuthLoading]       = useState(true);
  const [profile, setProfile]               = useState<Profile>({ full_name:"", persona:"General", objective:"" });
  const [editingName, setEditingName]       = useState(false);
  const [nameInput, setNameInput]           = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [messages, setMessages]             = useState<any[]>([]);
  const [tasks, setTasks]                   = useState<Task[]>([]);
  const [newTaskText, setNewTaskText]       = useState("");
  const [isLoading, setIsLoading]           = useState(false);
  const [inputText, setInputText]           = useState("");
  const [activeCompanion, setActiveCompanion] = useState(COMPANIONS[0]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // !! PANELS: all start CLOSED (false) !!
  const [isTaskOpen, setIsTaskOpen]         = useState(false);
  const [isProfileOpen, setIsProfileOpen]   = useState(false);
  const [isHistoryOpen, setIsHistoryOpen]   = useState(false);
  const [isListening, setIsListening]       = useState(false);
  const [pokeCount, setPokeCount]           = useState(0);
  const [lastPoke, setLastPoke]             = useState(0);
  const [isMounted, setIsMounted]           = useState(false);
  const [currentTime, setCurrentTime]       = useState("");
  const [currentMood, setCurrentMood]       = useState<Mood>("neutral");
  const [moodMessage, setMoodMessage]       = useState("");
  const [showMoodBanner, setShowMoodBanner] = useState(false);
  const [xp, setXP]                         = useState(0);
  const [streak, setStreak]                 = useState(1);
  const [showLevelUp, setShowLevelUp]       = useState(false);
  const [levelUpNum, setLevelUpNum]         = useState(1);
  const [showBriefing, setShowBriefing]     = useState(false);
  const [companionAnim, setCompanionAnim]   = useState<""|"bounce"|"wave">("");
  const [quotaRemaining, setQuotaRemaining] = useState<number|null>(null);
  const [showQuotaWarn, setShowQuotaWarn]   = useState(false);

  const prevLevelRef   = useRef(1);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const greetingSetRef = useRef(false);

  const { accent, accentRgb, theme } = activeCompanion;
  const ts      = T[theme as keyof typeof T];
  const level   = getLevelFromXP(xp);
  const nxtXP   = getXPForLevel(level+1);
  const curXP   = getXPForLevel(level);
  const xpPct   = Math.min(100, ((xp-curXP)/(nxtXP-curXP))*100);
  const isEva   = theme==="eva";
  const isSpark = theme==="spark";

  // ── MOUNT + CLOCK ──────────────────────────────────────────────────────────
  useEffect(() => {
    setIsMounted(true);
    // Restore companion from localStorage immediately on mount
    const saved = localStorage.getItem("aegis_companion");
    if (saved) {
      const found = COMPANIONS.find(c=>c.id===saved);
      if (found) setActiveCompanion(found);
    }
    const tick = () => setCurrentTime(new Date().toLocaleTimeString("en-US",{hour12:false}));
    tick(); const iv = setInterval(tick,1000); return ()=>clearInterval(iv);
  },[]);

  // ── XP / STREAK ────────────────────────────────────────────────────────────
  useEffect(() => {
    const savedXP     = parseInt(localStorage.getItem("aegis_xp")||"0");
    const savedStreak = parseInt(localStorage.getItem("aegis_streak")||"1");
    const lastDate    = localStorage.getItem("aegis_last_date");
    const today       = new Date().toDateString();
    const yesterday   = new Date(Date.now()-86400000).toDateString();
    setXP(savedXP); prevLevelRef.current = getLevelFromXP(savedXP);
    if (lastDate!==today) {
      const ns = lastDate===yesterday ? savedStreak+1 : lastDate ? 1 : savedStreak;
      setStreak(ns); localStorage.setItem("aegis_streak",String(ns)); localStorage.setItem("aegis_last_date",today);
    } else { setStreak(savedStreak); }
  },[]);

  useEffect(() => {
    if (xp===0) return;
    localStorage.setItem("aegis_xp",String(xp));
    const nl = getLevelFromXP(xp);
    if (nl>prevLevelRef.current) {
      setLevelUpNum(nl); setShowLevelUp(true); playSound("levelup",theme);
      prevLevelRef.current=nl; setTimeout(()=>setShowLevelUp(false),3500);
    }
  },[xp]);

  const addXP = useCallback((n:number)=>setXP(p=>p+n),[]);

  // ── SESSION ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setAuthLoading(false);});
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,s)=>{setSession(s);setAuthLoading(false);});
    return ()=>subscription.unsubscribe();
  },[]);

  // ── DATA FETCH ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session||greetingSetRef.current) return;
    greetingSetRef.current = true;
    (async () => {
      const {data:pData} = await supabase.from("profiles").select("*").eq("id",session.user.id).single();
      if (pData) { setProfile(pData); setNameInput(pData.full_name||""); }
      const {data:tData} = await supabase.from("tasks").select("*").order("created_at",{ascending:true});
      if (tData) setTasks(tData);

      const savedCompId = localStorage.getItem("aegis_companion");
      const companion   = COMPANIONS.find(c=>c.id===savedCompId)||COMPANIONS[0];
      setActiveCompanion(companion);

      const name    = pData?.full_name||"Agent";
      const hour    = new Date().getHours();
      const tod     = hour<12?"morning":hour<18?"afternoon":"evening";
      const str     = parseInt(localStorage.getItem("aegis_streak")||"1");
      const pending = (tData||[]).filter((t:Task)=>!t.completed).length;

      const msg = `Good ${tod}, ${name}! 🌅 ${(tData||[]).length} tasks (${pending} pending) · Streak: ${str} days 🔥\n\n${companion.greeting(name)}`;
      setMessages([{role:"assistant",content:msg}]);
      setShowBriefing(true);
      playSound("briefing","squish");
      setTimeout(()=>setShowBriefing(false),7000);
    })();
  },[session]);

  // ── COMPANION SWITCH ───────────────────────────────────────────────────────
  const switchCompanion = (c: typeof COMPANIONS[0]) => {
    if (c.id===activeCompanion.id) return;
    playSound("switch",c.theme); setIsTransitioning(true);
    setTimeout(()=>{ setActiveCompanion(c); localStorage.setItem("aegis_companion",c.id); setIsTransitioning(false); },380);
  };

  // ── PROFILE ────────────────────────────────────────────────────────────────
  const saveName = async () => {
    if (!nameInput.trim()||!session) return;
    await supabase.from("profiles").update({full_name:nameInput.trim()}).eq("id",session.user.id);
    setProfile(p=>({...p,full_name:nameInput.trim()})); setEditingName(false);
  };
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0]; if(!file||!session) return;
    setAvatarUploading(true);
    try {
      const ext=file.name.split(".").pop();
      const path=`avatars/${session.user.id}.${ext}`;
      const {error:upErr}=await supabase.storage.from("avatars").upload(path,file,{upsert:true});
      if(upErr) throw upErr;
      const {data}=supabase.storage.from("avatars").getPublicUrl(path);
      const url=data.publicUrl+"?t="+Date.now();
      await supabase.from("profiles").update({avatar_url:url}).eq("id",session.user.id);
      setProfile(p=>({...p,avatar_url:url}));
    } catch { alert("Upload failed. Create 'avatars' bucket in Supabase Storage → public access."); }
    setAvatarUploading(false);
  };

  // ── TASKS ──────────────────────────────────────────────────────────────────
  const handleAddTask = async () => {
    if(!newTaskText.trim()||!session) return;
    const {data,error}=await supabase.from("tasks").insert({text:newTaskText.trim(),category:"general",completed:false,user_id:session.user.id}).select().single();
    if(!error&&data){setTasks(p=>[...p,data]);setNewTaskText("");addXP(25);}
  };
  const handleToggleTask = async (task:Task) => {
    await supabase.from("tasks").update({completed:!task.completed}).eq("id",task.id);
    setTasks(p=>p.map(t=>t.id===task.id?{...t,completed:!t.completed}:t));
  };

  // ── POKE ───────────────────────────────────────────────────────────────────
  const handlePoke = () => {
    playSound("poke",theme); setLastPoke(Date.now()); setCompanionAnim("bounce"); addXP(2);
    setTimeout(()=>setCompanionAnim(""),700);
    setPokeCount(p=>{
      const n=p+1;
      if(n>=5){
        handleSendMessage(
          isEva?"Touch sensors malfunctioning. Cease contact.":
          isSpark?"STOPPP ITTTTT 😤 (ok that was kinda funny tho)":
          "Hey! Stop poking me! 😅",false
        ); return 0;
      }
      return n;
    });
  };

  // ── VOICE — per-companion wake word ───────────────────────────────────────
  const startListening = () => {
    playSound("click",theme);
    const SR=(window as any).webkitSpeechRecognition||(window as any).SpeechRecognition;
    if(!SR){ alert("Voice recognition not supported in this browser. Try Chrome!"); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onstart = () => setIsListening(true);
    rec.onerror = () => setIsListening(false);
    rec.onend   = () => setIsListening(false);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript.toLowerCase().trim();
      console.log("Voice transcript:", transcript);

      // Check if transcript matches any companion's wake word
      const matchedCompanion = COMPANIONS.find(c =>
        c.wakeWords.some(w => transcript.includes(w))
      );

      if (matchedCompanion) {
        // Switch to that companion if different
        if (matchedCompanion.id !== activeCompanion.id) {
          switchCompanion(matchedCompanion);
          setTimeout(() => {
            const greetMsg = `${matchedCompanion.name} activated! ${matchedCompanion.greeting(profile.full_name||"Agent")}`;
            handleSendMessage(greetMsg, false);
          }, 500);
        } else {
          // Same companion — just trigger greeting
          handleSendMessage(`${activeCompanion.name} is online and listening!`, false);
        }
      } else {
        // Normal message
        handleSendMessage(e.results[0][0].transcript);
      }
    };
    rec.start();
  };

  // ── SEND MESSAGE ───────────────────────────────────────────────────────────
  const handleSendMessage = async (override?:string, isSilent=false) => {
    const text=override||inputText;
    if(!text.trim()) return;
    playSound("send",theme); setIsLoading(true);
    if(!override) setInputText("");
    const mood=detectMood(text);
    if(mood!=="neutral"&&mood!==currentMood){
      setCurrentMood(mood);
      const opts=activeCompanion.moodKeywords[mood];
      setMoodMessage(opts[Math.floor(Math.random()*opts.length)]);
      setShowMoodBanner(true); setTimeout(()=>setShowMoodBanner(false),4200);
    }
    try {
      const res=await fetch("/api/chat",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:text,companionId:activeCompanion.id,chatHistory:messages.slice(-6),userProfile:profile,currentMood:mood}),
      });
      if(!res.ok) throw new Error(`API ${res.status}`);
      const data=await res.json();
      setMessages(p=>[...p,{role:"user",content:text},{role:"assistant",content:data.reply}]);
      addXP(10); setCompanionAnim("wave"); setTimeout(()=>setCompanionAnim(""),700);
      if(!isSilent) speakText(data.reply,activeCompanion);
    } catch(e){
      console.error(e);
      setMessages(p=>[...p,{role:"user",content:text},{role:"assistant",content:"Sorry, couldn't connect. Check your internet and try again."}]);
    }
    finally { setIsLoading(false); }
  };

  // ── TTS ────────────────────────────────────────────────────────────────────
  const speakText = async (text:string, c:typeof COMPANIONS[0]) => {
    const clean=text.replace(/\[.*?\]/g,"").replace(/[*_#`~]/g,"").trim().slice(0,500);
    try {
      const res=await fetch("/api/tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:clean,voiceId:c.voiceId})});
      const rem=res.headers.get("X-EL-Remaining");
      if(rem){const r=parseInt(rem);setQuotaRemaining(r);if(r<1500&&r>0){setShowQuotaWarn(true);setTimeout(()=>setShowQuotaWarn(false),6000);}}
      if(!res.ok){browserTTS(clean,c.id);return;}
      const ct=res.headers.get("content-type")||"";
      if(ct.includes("audio")){
        const blob=await res.blob();const url=URL.createObjectURL(blob);const audio=new Audio(url);
        if(c.id==="eva") audio.playbackRate=0.85;
        if(c.id==="spark") audio.playbackRate=1.15;
        audio.onended=()=>URL.revokeObjectURL(url); await audio.play();
      } else browserTTS(clean,c.id);
    } catch { browserTTS(clean,c.id); }
  };
  const browserTTS=(text:string,id:string)=>{
    if(!window.speechSynthesis)return;
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    const voices=window.speechSynthesis.getVoices();
    if(id==="eva")  {u.rate=0.82;u.pitch=0.65;const v=voices.find(v=>/daniel|george|male/i.test(v.name));if(v)u.voice=v;}
    else if(id==="spark"){u.rate=1.2;u.pitch=1.75;const v=voices.find(v=>/samantha|female/i.test(v.name));if(v)u.voice=v;}
    else            {u.rate=1.0;u.pitch=1.2;}
    window.speechSynthesis.speak(u);
  };

  // ── GUARDS ────────────────────────────────────────────────────────────────
  if(authLoading) return (
    <div style={{height:"100dvh",background:"#050508",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"16px"}}>
      <svg width="60" height="60" viewBox="0 0 100 100" fill="none" style={{animation:"spin-slow 3s linear infinite"}}>
        <polygon points="50,4 93,27.5 93,72.5 50,96 7,72.5 7,27.5" stroke="#F59E0B" strokeWidth="2.5" fill="none"/>
        <circle cx="50" cy="50" r="14" stroke="#F59E0B" strokeWidth="2" fill="none"/>
        <circle cx="50" cy="50" r="6" fill="#F59E0B"/>
      </svg>
      <p style={{fontFamily:"monospace",fontSize:"11px",color:"#F59E0B",letterSpacing:".35em"}}>INITIALIZING AEGIS...</p>
      <style>{`@keyframes spin-slow{to{transform:rotate(360deg)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if(!session) return <Auth/>;

  const lastMsg   = messages.slice().reverse().find(m=>m.role==="assistant")?.content||"Ready for input.";
  const userEmail = session?.user?.email||"";
  const doneTasks = tasks.filter(t=>t.completed).length;

  // ── PANEL STYLE (controlled by JS, not Tailwind) ──────────────────────────
  const panelStyle = (open: boolean, side: "left"|"right"): React.CSSProperties => ({
    position: "fixed", top: 0,
    height: "100dvh" as any,
    width: "min(300px, 85vw)",
    zIndex: 110,
    transition: "transform 0.4s cubic-bezier(0.23,1,0.32,1)",
    transform: open ? "translateX(0)" : side==="left" ? "translateX(-110%)" : "translateX(110%)",
    [side]: 0,
    display: "flex", flexDirection: "column",
    overflowY: "hidden",
    ...(side==="left" ? ts.panel : ts.panelRight),
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Bubblegum+Sans&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');

        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes spin-slow{to{transform:rotate(360deg)}}
        @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes aura-pulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
        @keyframes dots-blink{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
        @keyframes msg-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mood-in{from{opacity:0;transform:translateX(-50%) translateY(-16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes mood-out{to{opacity:0;transform:translateX(-50%) translateY(-16px)}}
        @keyframes briefing-in{from{opacity:0;transform:translateX(-50%) scale(.85)}to{opacity:1;transform:translateX(-50%) scale(1)}}
        @keyframes levelup-in{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}15%{opacity:1;transform:translate(-50%,-60%) scale(1.1)}85%{opacity:1;transform:translate(-50%,-60%) scale(1)}100%{opacity:0;transform:translate(-50%,-78%) scale(.9)}}
        @keyframes flash{0%{opacity:0}50%{opacity:1}100%{opacity:0}}
        @keyframes bounce-comp{0%,100%{transform:translateY(0)}35%{transform:translateY(-18px)}65%{transform:translateY(-7px)}}
        @keyframes wave-comp{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
        @keyframes sq-blob1{0%,100%{transform:translate(0,0)}50%{transform:translate(-12px,16px)}}
        @keyframes sq-blob2{0%,100%{transform:translate(0,0)}50%{transform:translate(10px,-12px)}}
        @keyframes spark-drift{from{background-position:0 0}to{background-position:30px 30px}}
        @keyframes spark-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes eva-ring{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(360deg)}}
        @keyframes eva-sweep{0%{top:15%;opacity:0}10%{opacity:1}90%{opacity:1}100%{top:85%;opacity:0}}

        /* Input placeholder color set via CSS vars */
        .aegis-input::placeholder { color: var(--ph-color); }
        .aegis-input { caret-color: var(--accent-color); }

        /* Scrollbar hide */
        .no-scroll::-webkit-scrollbar { display: none; }
        .no-scroll { scrollbar-width: none; -webkit-overflow-scrolling: touch; }

        /* Mobile tap states */
        button:active { opacity: 0.8; transform: scale(0.97); }

        /* Prevent iOS zoom on input focus */
        input { font-size: 16px !important; }
        @media (min-width: 480px) {
          input { font-size: 14px !important; }
        }
      `}</style>

      {/* ── ROOT CONTAINER ── */}
      <div style={{
        height:"100dvh" as any,
        width:"100%", overflow:"hidden", position:"relative",
        background: ts.bg,
        fontFamily: ts.font,
        display:"flex", flexDirection:"column",
        "--accent-color": accent,
        "--ph-color": ts.ph,
      } as React.CSSProperties}>

        {/* ── EVA DECO ── */}
        {isEva && <>
          <div style={{position:"fixed",borderRadius:"50%",border:"1px solid rgba(100,116,139,.08)",pointerEvents:"none",top:"50%",left:"50%",width:"600px",height:"600px",animation:"eva-ring 24s linear infinite"}}/>
          <div style={{position:"fixed",borderRadius:"50%",border:"1px dashed rgba(100,116,139,.06)",pointerEvents:"none",top:"50%",left:"50%",width:"420px",height:"420px",animation:"eva-ring 17s linear infinite reverse"}}/>
          <div style={{position:"fixed",left:0,right:0,height:"1px",pointerEvents:"none",background:"linear-gradient(90deg,transparent,rgba(100,116,139,.25),transparent)",animation:"eva-sweep 5s ease-in-out infinite"}}/>
          <div style={{position:"fixed",inset:0,pointerEvents:"none",backgroundImage:"linear-gradient(rgba(100,116,139,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(100,116,139,.03) 1px,transparent 1px)",backgroundSize:"40px 40px"}}/>
        </>}

        {/* ── SQUISH DECO ── */}
        {theme==="squish" && <>
          <div style={{position:"fixed",width:"250px",height:"250px",borderRadius:"50%",background:"radial-gradient(circle,rgba(251,191,36,.1) 0%,transparent 70%)",top:"-40px",right:"-40px",pointerEvents:"none",animation:"sq-blob1 7s ease-in-out infinite"}}/>
          <div style={{position:"fixed",width:"180px",height:"180px",borderRadius:"50%",background:"radial-gradient(circle,rgba(245,158,11,.07) 0%,transparent 70%)",bottom:"100px",left:"-20px",pointerEvents:"none",animation:"sq-blob2 9s ease-in-out infinite"}}/>
        </>}

        {/* ── SPARK DECO ── */}
        {isSpark && <>
          <div style={{position:"fixed",inset:0,pointerEvents:"none",backgroundImage:"radial-gradient(circle,rgba(236,72,153,.06) 1.5px,transparent 1.5px)",backgroundSize:"30px 30px",animation:"spark-drift 25s linear infinite",zIndex:0}}/>
          {["✦","★","💖","✨","🌸"].map((s,i)=>(
            <div key={i} style={{position:"fixed",pointerEvents:"none",animation:`spark-float 4s ease-in-out infinite`,animationDelay:`${i*.65}s`,opacity:.25,fontSize:"16px",color:i%2===0?"#EC4899":"#F472B6",left:i<3?`${8+i*22}%`:undefined,right:i>=3?`${5+(i-3)*22}%`:undefined,top:`${4+(i%3)*7}%`,zIndex:0}}>{s}</div>
          ))}
        </>}

        {/* ── TRANSITION FLASH ── */}
        {isTransitioning && <div style={{position:"fixed",inset:0,zIndex:9998,pointerEvents:"none",background:`rgba(${accentRgb},.12)`,animation:"flash .4s ease"}}/>}

        <AppDownloadBanner/>

        {/* ── LEVEL UP ── */}
        {showLevelUp && (
          <div style={{position:"fixed",top:"50%",left:"50%",zIndex:9999,pointerEvents:"none",animation:"levelup-in 3.5s ease forwards"}}>
            <div style={{padding:"16px 32px",borderRadius:isEva?"8px":"20px",background:isEva?"rgba(0,0,0,.92)":"rgba(255,255,255,.96)",border:`2px solid ${accent}`,boxShadow:`0 0 40px rgba(${accentRgb},.5)`,textAlign:"center"}}>
              <div style={{fontSize:"28px",marginBottom:"6px"}}>🏆</div>
              <div style={{...ts.ptitle,fontSize:isEva?"12px":"17px",color:accent}}>
                {isSpark?`LEVEL ${levelUpNum} UNLOCKED!! 🎉`:isEva?`LEVEL_${levelUpNum}_REACHED`:`Level ${levelUpNum} reached! ✨`}
              </div>
            </div>
          </div>
        )}

        {/* ── MOOD BANNER ── */}
        {showMoodBanner && (
          <div style={{position:"fixed",top:"60px",left:"50%",zIndex:500,pointerEvents:"none",animation:"mood-in .4s ease, mood-out .4s ease 3.8s forwards",whiteSpace:"nowrap",maxWidth:"88vw"}}>
            <div style={{padding:"9px 18px",borderRadius:isEva?"4px":"18px",background:isEva?"rgba(0,0,0,.88)":"rgba(255,255,255,.93)",border:`1.5px solid rgba(${accentRgb},.5)`,boxShadow:`0 4px 20px rgba(${accentRgb},.18)`,display:"flex",alignItems:"center",gap:"8px",...ts.stxt}}>
              <span style={{fontSize:"16px"}}>{currentMood==="stressed"?"💛":currentMood==="happy"?"🎉":"🎯"}</span>
              {moodMessage}
            </div>
          </div>
        )}

        {/* ── QUOTA WARN ── */}
        {showQuotaWarn && quotaRemaining!==null && (
          <div style={{position:"fixed",bottom:"90px",left:"50%",zIndex:9000,pointerEvents:"none",animation:"mood-in .4s ease, mood-out .4s ease 5.6s forwards",whiteSpace:"nowrap",maxWidth:"88vw"}}>
            <div style={{padding:"9px 18px",borderRadius:"12px",background:"rgba(239,68,68,.12)",border:"1.5px solid rgba(239,68,68,.5)",fontFamily:"'Share Tech Mono',monospace",fontSize:"10px",color:"#FCA5A5",display:"flex",alignItems:"center",gap:"8px"}}>
              <span>⚠️</span>Voice quota low — {quotaRemaining.toLocaleString()} chars left.
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            HISTORY PANEL — left, JS-controlled
        ══════════════════════════════════════ */}
        <div style={panelStyle(isHistoryOpen,"left")}>
          <div style={{padding:"20px 18px",flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px",flexShrink:0}}>
              <div style={ts.ptitle}>{isEva?"SYNC_LOGS":isSpark?"💬 History!!":"Chat History"}</div>
              <button onClick={()=>setIsHistoryOpen(false)} style={{...ts.btnBase,padding:"6px 10px",cursor:"pointer"}}>✕</button>
            </div>
            <div className="no-scroll" style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:"8px"}}>
              {messages.map((m,i)=>(
                <div key={i} style={{...m.role==="user"?ts.muser:ts.mbot,padding:"9px 12px"}}>
                  <div style={{fontFamily:"monospace",fontSize:"8px",opacity:.35,marginBottom:"3px",textTransform:"uppercase"}}>{m.role==="user"?"▶ You":`◆ ${activeCompanion.name}`}</div>
                  <div style={{fontSize:"12px",lineHeight:1.45,opacity:.78}}>{m.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════
            GOALS PANEL — left, JS-controlled
        ══════════════════════════════════════ */}
        <div style={{...panelStyle(isTaskOpen,"left"),zIndex:120}}>
          <div style={{padding:"20px 18px",flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px",flexShrink:0}}>
              <div style={ts.ptitle}>{isEva?"OBJECTIVES":isSpark?"🎯 Goals!!":"My Goals 🎯"}</div>
              <button onClick={()=>setIsTaskOpen(false)} style={{...ts.btnBase,padding:"6px 10px",cursor:"pointer"}}>✕</button>
            </div>
            <div className="no-scroll" style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:"8px"}}>
              {tasks.length===0
                ?<div style={{textAlign:"center",padding:"40px 0",opacity:.25,fontFamily:"monospace",fontSize:"12px"}}>No objectives yet</div>
                :tasks.map(t=>(
                  <div key={t.id} style={{...ts.mbot,padding:"10px 12px",cursor:"pointer"}} onClick={()=>handleToggleTask(t)}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <div style={{width:"15px",height:"15px",borderRadius:"50%",border:`2px solid rgba(${accentRgb},.5)`,background:t.completed?accent:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",color:"black",fontWeight:"bold"}}>{t.completed?"✓":""}</div>
                      <div style={{fontSize:"13px",fontWeight:600,opacity:.8,textDecoration:t.completed?"line-through":"none"}}>{t.text}</div>
                    </div>
                  </div>
                ))}
            </div>
            <div style={{marginTop:"10px",display:"flex",gap:"8px",alignItems:"center",borderTop:`1px solid rgba(${accentRgb},.15)`,paddingTop:"10px",flexShrink:0}}>
              <input
                style={{background:"transparent",border:"none",borderBottom:`1.5px solid`,outline:"none",flex:1,padding:"4px 6px",minWidth:0,...ts.taskInp}}
                placeholder={isEva?"Enter objective...":isSpark?"New goal!! ✨":"Add a goal..."}
                value={newTaskText} onChange={e=>setNewTaskText(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleAddTask()}/>
              <button style={{...ts.sbtn,padding:"7px 12px",cursor:"pointer",borderRadius:isEva?"4px":"14px",fontSize:"12px"}} onClick={handleAddTask}>+</button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════
            PROFILE PANEL — right, JS-controlled
        ══════════════════════════════════════ */}
        <div style={panelStyle(isProfileOpen,"right")}>
          <div className="no-scroll" style={{padding:"20px 18px",flex:1,display:"flex",flexDirection:"column",alignItems:"center",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",width:"100%",marginBottom:"18px",flexShrink:0}}>
              <div style={ts.ptitle}>{isEva?"AGENT_STATS":isSpark?"✨ Stats!!":"My Stats 👤"}</div>
              <button onClick={()=>setIsProfileOpen(false)} style={{...ts.btnBase,padding:"6px 10px",cursor:"pointer"}}>✕</button>
            </div>
            {/* Avatar */}
            <div style={{position:"relative",marginBottom:"8px",cursor:"pointer"}} onClick={()=>fileInputRef.current?.click()}>
              <div style={{width:"72px",height:"72px",borderRadius:"50%",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",background:`rgba(${accentRgb},.1)`,border:`2px solid rgba(${accentRgb},.5)`,boxShadow:`0 0 16px rgba(${accentRgb},.22)`}}>
                {avatarUploading
                  ?<div style={{width:"22px",height:"22px",border:`2px solid rgba(${accentRgb},.3)`,borderTop:`2px solid ${accent}`,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
                  :profile.avatar_url?<img src={profile.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  :<span style={{fontSize:"30px"}}>👤</span>}
              </div>
              <div style={{...ts.dot,position:"absolute",bottom:2,right:2,width:"9px",height:"9px",borderRadius:"50%"}}/>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarUpload}/>
            <div style={{fontFamily:"monospace",fontSize:"8px",opacity:.25,marginBottom:"8px"}}>tap to change photo</div>
            {/* Name edit */}
            {editingName?(
              <div style={{width:"100%",display:"flex",gap:"6px",alignItems:"center",marginBottom:"4px"}}>
                <input style={{background:"transparent",border:"none",borderBottom:"2px solid",outline:"none",fontWeight:700,fontSize:"16px",textAlign:"center",width:"100%",padding:"2px 4px",...ts.nameEdit}}
                  value={nameInput} onChange={e=>setNameInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")saveName();if(e.key==="Escape")setEditingName(false);}} autoFocus/>
                <button style={{...ts.sbtn,padding:"5px 10px",cursor:"pointer",borderRadius:"8px",fontSize:"11px"}} onClick={saveName}>✓</button>
              </div>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"4px",cursor:"pointer"}} onClick={()=>setEditingName(true)}>
                <div style={{...ts.ptitle,fontSize:"17px",fontWeight:700,color:accent}}>{profile.full_name||"AGENT"}</div>
                <span style={{fontSize:"11px",opacity:.4}}>✏️</span>
              </div>
            )}
            <div style={{fontFamily:"monospace",fontSize:"10px",opacity:.4,marginBottom:"4px",textAlign:"center",wordBreak:"break-all",maxWidth:"100%"}}>{userEmail}</div>
            <div style={{fontFamily:"monospace",fontSize:"8px",opacity:.25,textTransform:"uppercase",marginBottom:"14px"}}>{profile.persona||"GENERAL"}</div>
            {/* XP bar */}
            <div style={{width:"100%",marginBottom:"14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                <span style={{fontFamily:"monospace",fontSize:"10px",color:accent}}>LVL {level}</span>
                <span style={{fontFamily:"monospace",fontSize:"9px",opacity:.35}}>{xp}/{nxtXP} XP</span>
              </div>
              <div style={{...ts.xpbg,width:"100%"}}>
                <div style={{...ts.xpfg,height:"100%",borderRadius:"inherit",width:`${xpPct}%`,transition:"width .8s cubic-bezier(.34,1.56,.64,1)"}}/>
              </div>
            </div>
            {/* Stats grid */}
            <div style={{width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:"12px"}}>
              {[{l:"LEVEL",v:level},{l:"STREAK",v:`${streak}🔥`},{l:"TASKS",v:`${doneTasks}/${tasks.length}`},{l:"POKES",v:pokeCount},{l:"MSGS",v:messages.length},{l:"XP",v:xp}].map((s,i)=>(
                <div key={i} style={{...ts.chip,padding:"4px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"4px"}}>
                  <span style={ts.chipL}>{s.l}</span><span style={ts.chipV}>{s.v}</span>
                </div>
              ))}
            </div>
            {/* Companion pref */}
            <div style={{width:"100%",padding:"10px",borderRadius:"12px",background:`rgba(${accentRgb},.06)`,border:`1px solid rgba(${accentRgb},.18)`,marginBottom:"12px"}}>
              <div style={{fontFamily:"monospace",fontSize:"7px",opacity:.35,textTransform:"uppercase",marginBottom:"8px"}}>DEFAULT COMPANION</div>
              <div style={{display:"flex",gap:"12px",justifyContent:"center",marginBottom:"5px"}}>
                {COMPANIONS.map(c=>(
                  <button key={c.id} onClick={()=>switchCompanion(c)} style={{
                    width:"32px",height:"32px",borderRadius:"50%",
                    background:c.bgColor,
                    border:`2.5px solid ${activeCompanion.id===c.id?"white":"transparent"}`,
                    cursor:"pointer",flexShrink:0,
                    transform:activeCompanion.id===c.id?"scale(1.2)":"scale(1)",
                    opacity:activeCompanion.id===c.id?1:0.35,
                    boxShadow:activeCompanion.id===c.id?`0 0 12px rgba(${c.accentRgb},.7)`:undefined,
                    transition:"all .3s",
                  }}/>
                ))}
              </div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:"8px",opacity:.4,textTransform:"uppercase",textAlign:"center",letterSpacing:".1em"}}>SAVED: {activeCompanion.name.toUpperCase()}</div>
            </div>
            {quotaRemaining!==null && (
              <div style={{width:"100%",padding:"9px 12px",borderRadius:"8px",background:quotaRemaining<1500?"rgba(239,68,68,.08)":"rgba(34,197,94,.06)",border:`1px solid ${quotaRemaining<1500?"rgba(239,68,68,.3)":"rgba(34,197,94,.25)"}`,marginBottom:"10px"}}>
                <div style={{fontFamily:"monospace",fontSize:"8px",opacity:.4,textTransform:"uppercase",marginBottom:"3px"}}>VOICE QUOTA</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:"11px",color:quotaRemaining<1500?"#FCA5A5":"#86EFAC"}}>{quotaRemaining.toLocaleString()} chars remaining</div>
              </div>
            )}
            <div style={{height:"12px",flexShrink:0}}/>
            <button onClick={()=>supabase.auth.signOut()} style={{...ts.btnRed,padding:"10px",cursor:"pointer",width:"100%",textAlign:"center",marginTop:"auto"}}>⏻ SIGN OUT</button>
          </div>
        </div>

        {/* ── BACKDROP ── */}
        {(isTaskOpen||isHistoryOpen||isProfileOpen) && (
          <div onClick={()=>{setIsTaskOpen(false);setIsHistoryOpen(false);setIsProfileOpen(false);}}
            style={{position:"fixed",inset:0,zIndex:90,background:"rgba(0,0,0,.3)",backdropFilter:"blur(4px)"}}/>
        )}

        {/* ══════════════════════════════════════════════════
            STATUS BAR
        ══════════════════════════════════════════════════ */}
        <div style={{...ts.sbar,flexShrink:0,padding:"7px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",minWidth:0,flex:1}}>
            <svg width="16" height="16" viewBox="0 0 100 100" fill="none" style={{flexShrink:0}}>
              <polygon points="50,4 93,27.5 93,72.5 50,96 7,72.5 7,27.5" stroke={accent} strokeWidth="3" fill="none" opacity="0.9"/>
              <circle cx="50" cy="50" r="13" stroke={accent} strokeWidth="2.5" fill="none"/>
              <circle cx="50" cy="50" r="5.5" fill={accent}/>
            </svg>
            <span style={{...ts.stxt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {isEva?`AEGIS_v2.0 — ${activeCompanion.status}`:isSpark?`✨ AEGIS — ${activeCompanion.status}`:`Aegis — ${activeCompanion.status}`}
            </span>
          </div>
          {isMounted && <span style={{...ts.stxt,opacity:.55,flexShrink:0}}>LVL {level} · {xp}XP · {streak}🔥</span>}
          {isMounted && <span style={{...ts.stxt,opacity:.3,flexShrink:0,display:"none" /* hidden on mobile */}}>{currentTime}</span>}
        </div>

        {/* ══════════════════════════════════════════════════
            MAIN CONTENT — fills remaining height
        ══════════════════════════════════════════════════ */}
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",position:"relative",overflow:"hidden",minHeight:0}}>

          {/* DAILY BRIEFING */}
          {showBriefing && (
            <div style={{position:"absolute",top:"8px",left:"50%",zIndex:300,width:"min(380px,88vw)",animation:"briefing-in .5s cubic-bezier(.34,1.56,.64,1)"}}>
              <div style={{padding:"14px 18px",borderRadius:isEva?"10px":isSpark?"22px":"24px",background:isEva?"rgba(0,0,0,.93)":"rgba(255,255,255,.97)",border:`2px solid rgba(${accentRgb},.4)`,boxShadow:`0 8px 30px rgba(${accentRgb},.18)`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                  <div style={{...ts.ptitle,fontSize:isEva?"9px":"12px",color:accent}}>{isEva?"◆ DAILY_BRIEFING":isSpark?"🌸 HEY!! ✨":"☀️ Welcome back!"}</div>
                  <button onClick={()=>setShowBriefing(false)} style={{...ts.btnBase,padding:"3px 7px",cursor:"pointer",fontSize:"10px"}}>✕</button>
                </div>
                <div style={{opacity:.75,...ts.txtMain,fontSize:"12px",textAlign:"left"}}>{lastMsg}</div>
                <div style={{display:"flex",gap:"6px",marginTop:"10px"}}>
                  <span style={{fontSize:"10px",padding:"3px 8px",borderRadius:"14px",background:`rgba(${accentRgb},.1)`,color:accent,fontFamily:"monospace"}}>🔥 {streak}d</span>
                  <span style={{fontSize:"10px",padding:"3px 8px",borderRadius:"14px",background:`rgba(${accentRgb},.1)`,color:accent,fontFamily:"monospace"}}>⚡ {tasks.length} tasks</span>
                </div>
              </div>
            </div>
          )}

          {/* ── HEADER ROW ── */}
          <div style={{width:"100%",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:50,flexShrink:0,gap:"6px"}}>
            {/* Left buttons */}
            <div style={{display:"flex",gap:"6px",flexShrink:0}}>
              <button onClick={()=>{playSound("click",theme);setIsTaskOpen(true);}} style={{...ts.btnBase,padding:"7px 12px",cursor:"pointer"}}>
                {isEva?"GOALS":isSpark?"🎯 Goals":"🎯 Goals"}
              </button>
              <button onClick={()=>{playSound("click",theme);setIsHistoryOpen(true);}} style={{...ts.btnBase,padding:"7px 12px",cursor:"pointer"}}>
                {isEva?"HISTORY":"💬"}
              </button>
              <button onClick={()=>{if(confirm("Clear chat?"))setMessages([{role:"assistant",content:activeCompanion.greeting(profile.full_name||"Agent")}]);}}
                style={{...ts.btnRed,padding:"7px 12px",cursor:"pointer"}}>
                {isEva?"WIPE":"Wipe"}
              </button>
            </div>

            {/* Companion selector — CENTER */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",flexShrink:0}}>
              <div style={{display:"flex",gap:"8px",padding:"7px 14px",borderRadius:"40px",...ts.compBox}}>
                {COMPANIONS.map(c=>(
                  <button key={c.id} onClick={()=>switchCompanion(c)} style={{
                    width:"30px",height:"30px",borderRadius:"50%",
                    background:c.bgColor,
                    border:`2.5px solid ${activeCompanion.id===c.id?"white":"transparent"}`,
                    cursor:"pointer",flexShrink:0,
                    transform:activeCompanion.id===c.id?"scale(1.25)":"scale(1)",
                    opacity:activeCompanion.id===c.id?1:0.3,
                    boxShadow:activeCompanion.id===c.id?`0 0 14px rgba(${c.accentRgb},.8)`:undefined,
                    transition:"all .3s",
                  }}/>
                ))}
              </div>
              <div style={{...ts.stxt,fontSize:"8px",letterSpacing:".12em",textTransform:"uppercase",color:`rgba(${accentRgb},.7)`}}>
                {activeCompanion.name} · {activeCompanion.label}
              </div>
            </div>

            {/* Profile button */}
            <button onClick={()=>{playSound("click",theme);setIsProfileOpen(true);}} style={{...ts.btnBase,padding:"7px 12px",cursor:"pointer",flexShrink:0}}>
              {isEva?"PROFILE":isSpark?"✨":"👤 Profile"}
            </button>
          </div>

          {/* ── CHAT BUBBLE ── */}
          <div style={{width:"100%",maxWidth:"520px",padding:"0 14px",zIndex:20,flexShrink:0}}>
            <div style={{...ts.card,padding:isEva?"14px 18px":"16px 22px",animation:"msg-in .35s ease"}}>
              {isEva && (
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:"8px",color:`rgba(${accentRgb},.55)`,marginBottom:"8px",display:"flex",alignItems:"center",gap:"6px",textTransform:"uppercase",letterSpacing:".12em"}}>
                  <span>◆ EVA_OUTPUT</span>
                  {isLoading && <span style={{display:"inline-flex",gap:"3px",alignItems:"center",color:accent}}>
                    {[0,1,2].map(i=><span key={i} style={{width:"4px",height:"4px",borderRadius:"50%",background:"currentColor",animation:`dots-blink 1.2s infinite`,animationDelay:`${i*.2}s`,display:"inline-block"}}/>)}
                  </span>}
                </div>
              )}
              <div style={ts.txtMain}>
                {isLoading ? (
                  <div style={{display:"flex",alignItems:"center",gap:"8px",justifyContent:isEva?"flex-start":"center",color:`rgba(${accentRgb},.7)`}}>
                    <span style={{fontSize:"12px"}}>{isSpark?"Sparkling... ✨":isEva?"PROCESSING...":"Thinking..."}</span>
                    <span style={{display:"inline-flex",gap:"3px",alignItems:"center"}}>
                      {[0,1,2].map(i=><span key={i} style={{width:"5px",height:"5px",borderRadius:"50%",background:accent,animation:`dots-blink 1.2s infinite`,animationDelay:`${i*.2}s`,display:"inline-block"}}/>)}
                    </span>
                  </div>
                ) : <ReactMarkdown>{lastMsg}</ReactMarkdown>}
              </div>
            </div>
          </div>

          {/* ── COMPANION 3D ── */}
          <div style={{
            flex:1,display:"flex",alignItems:"center",justifyContent:"center",
            minHeight:0,width:"100%",position:"relative",
          }}>
            <div style={{
              position:"relative",
              width:"clamp(200px, 40vw, 320px)",
              height:"clamp(200px, 40vw, 320px)",
              animation:companionAnim==="bounce"?"bounce-comp .6s cubic-bezier(.36,.07,.19,.97)":companionAnim==="wave"?"wave-comp .6s ease-in-out":undefined,
            }}>
              <div style={{position:"absolute",inset:"-15%",borderRadius:"50%",pointerEvents:"none",background:ts.aura,animation:"aura-pulse 3s ease-in-out infinite"}}/>
              <Companion3D activeColor={activeCompanion.id==="squish"?"bg-yellow-400":activeCompanion.id==="eva"?"bg-slate-500":"bg-pink-500"} isThinking={isLoading} companionId={activeCompanion.id} onPoke={handlePoke} lastPoke={lastPoke}/>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            BOTTOM — always visible, never cut off
        ══════════════════════════════════════════════════ */}
        <div style={{
          flexShrink:0,
          width:"100%",
          padding:"6px 14px",
          paddingBottom:`max(12px, env(safe-area-inset-bottom))`,
          display:"flex",
          flexDirection:"column",
          gap:"7px",
        }}>
          {/* Stats chips */}
          <div style={{display:"flex",justifyContent:"center",gap:"6px",flexWrap:"nowrap",overflowX:"auto"}}>
            {[{l:"LVL",v:level},{l:"XP",v:xp},{l:"STREAK",v:`${streak}🔥`},{l:"TASKS",v:`${doneTasks}/${tasks.length}`}].map((s,i)=>(
              <div key={i} style={{...ts.chip,padding:"4px 10px",display:"flex",alignItems:"center",gap:"4px",flexShrink:0}}>
                <span style={ts.chipL}>{s.l}</span><span style={ts.chipV}>{s.v}</span>
              </div>
            ))}
          </div>

          {/* XP bar */}
          <div style={{maxWidth:"600px",margin:"0 auto",width:"100%"}}>
            <div style={{...ts.xpbg,width:"100%"}}>
              <div style={{...ts.xpfg,height:"100%",borderRadius:"inherit",width:`${xpPct}%`,transition:"width .8s cubic-bezier(.34,1.56,.64,1)"}}/>
            </div>
          </div>

          {/* INPUT BAR */}
          <div style={{
            maxWidth:"640px",margin:"0 auto",width:"100%",
            ...ts.ibar,
            display:"flex",
            alignItems:"center",
            gap:"8px",
            padding:"8px 8px 8px 14px",
          }}>
            {isEva && <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:"9px",color:`rgba(${accentRgb},.45)`,flexShrink:0}}>▶</span>}
            <input
              className="aegis-input"
              value={inputText}
              onChange={e=>setInputText(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleSendMessage()}
              style={{
                background:"transparent",border:"none",outline:"none",
                flex:1,minWidth:0,
                ...ts.inp,
              }}
              placeholder={isEva?"AWAITING COMMAND...":isSpark?"tell me everything!! 💖":"Ask me anything..."}
            />
            {/* MIC button */}
            <button
              onClick={startListening}
              style={{
                ...ts.mic,
                borderRadius:"50%",
                width:"38px",height:"38px",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:"16px",cursor:"pointer",flexShrink:0,
                transition:"all .2s",
                ...(isListening?{borderColor:"#EF4444",background:"rgba(239,68,68,.15)",animation:"pulse-dot 1s infinite"}:{}),
              }}>
              🎤
            </button>
            {/* SEND button */}
            <button
              onClick={()=>handleSendMessage()}
              style={{
                ...ts.sbtn,
                padding:"9px 16px",
                cursor:"pointer",
                flexShrink:0,
              }}>
              {isEva?"GO ▶":isSpark?"SEND 💌":"Send ✦"}
            </button>
          </div>

          {/* Voice tip */}
          <div style={{textAlign:"center",...ts.stxt,fontSize:"9px",opacity:.3}}>
            🎤 Say "Hey {activeCompanion.name}" to activate voice
          </div>
        </div>
      </div>
    </>
  );
}
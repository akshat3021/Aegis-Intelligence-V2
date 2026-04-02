"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "../lib/supabase";
import Companion3D from "../components/Companion3D";
import Auth from "../components/Auth";
import AppDownloadBanner from "../components/AppDownloadBanner";

// ─── COMPANIONS ──────────────────────────────────────────────────────────────
const COMPANIONS = [
  {
    id: "squish", name: "Squish", color: "bg-yellow-400",
    accent: "#F59E0B", accentRgb: "245,158,11",
    voiceId: "DXFkLCBUTmvXpp2QwZjA",
    label: "FRIENDLY_UNIT", status: "HELPFUL MODE", theme: "squish",
    greeting: (name: string) =>
      `Hey ${name}! 💛 Squish is here and ready to help. What are we working on today?`,
    moodKeywords: {
      stressed: ["Hey breathe! You got this 💛", "One step at a time~", "Let's tackle this together! 🤗"],
      happy:    ["Yay! I love your energy! ✨", "Let's gooo! 🎉", "Squishing with joy right now!"],
      focused:  ["Locked in! Let's crush it! 🎯", "Focus mode: ON 🔥", "You're in the zone!"],
    },
  },
  {
    id: "eva", name: "Eva", color: "bg-slate-500",
    accent: "#64748B", accentRgb: "100,116,139",
    voiceId: "WeA4Q36twV5kwSaTEL0Q",
    label: "TECH_CORE", status: "ANALYTICAL MODE", theme: "eva",
    greeting: (name: string) =>
      `AEGIS_ONLINE. Agent ${name} detected. All systems nominal. Awaiting your command.`,
    moodKeywords: {
      stressed: ["Recalibrating. Stress detected. Initiating calm protocols.", "Suggest task decomposition."],
      happy:    ["Positive sentiment logged. Optimal performance state active.", "Morale coefficient: high."],
      focused:  ["Deep focus mode engaged. Noise suppression: active.", "Concentration matrix: optimal."],
    },
  },
  {
    id: "spark", name: "Spark", color: "bg-pink-500",
    accent: "#EC4899", accentRgb: "236,72,153",
    voiceId: "rnaFpqVpBnt4nZq1fII4",
    label: "MOTIVATOR", status: "HYPERDRIVE MODE", theme: "spark",
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
    const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc  = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    const now  = ctx.currentTime;
    const fmap: Record<string,number> = { squish:880, eva:660, spark:1046 };
    if (type==="click")   { osc.type="sine";     osc.frequency.setValueAtTime(440,now);          g.gain.setValueAtTime(.04,now); }
    if (type==="send")    { osc.type="sine";     osc.frequency.setValueAtTime(fmap[theme]||880,now); g.gain.setValueAtTime(.06,now); }
    if (type==="poke")    { osc.type="triangle"; osc.frequency.setValueAtTime(300,now); osc.frequency.exponentialRampToValueAtTime(150,now+.15); g.gain.setValueAtTime(.08,now); }
    if (type==="switch")  { osc.type="sine";     osc.frequency.setValueAtTime(660,now); osc.frequency.setValueAtTime(880,now+.08); g.gain.setValueAtTime(.06,now); }
    if (type==="briefing"){ osc.type="sine";     osc.frequency.setValueAtTime(523,now); osc.frequency.setValueAtTime(659,now+.12); g.gain.setValueAtTime(.08,now); }
    if (type==="levelup") { osc.type="sine"; [523,659,784,1046].forEach((f,i)=>osc.frequency.setValueAtTime(f,now+i*.1)); g.gain.setValueAtTime(.12,now); }
    g.gain.exponentialRampToValueAtTime(.001, now+.35);
    osc.start(now); osc.stop(now+.35);
  } catch(_) {}
}

const getLevelFromXP = (xp: number) => Math.floor(Math.pow(xp/80,.6))+1;
const getXPForLevel  = (l: number)  => Math.ceil(Math.pow(l-1,1.667)*80);

interface Task    { id: string; text: string; category: string; completed: boolean; }
interface Profile { full_name: string; persona: string; objective: string; avatar_url?: string; }

const QUOTA_WARN = 1500;

export default function Home() {
  const [session, setSession]               = useState<any>(null);
  const [authLoading, setAuthLoading]       = useState(true);
  const [profile, setProfile]               = useState<Profile>({ full_name:"", persona:"General", objective:"" });
  const [editingName, setEditingName]       = useState(false);
  const [nameInput, setNameInput]           = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  // ── Chat: always starts EMPTY, companion greeting is set after profile loads ──
  const [messages, setMessages]             = useState<any[]>([]);
  const [tasks, setTasks]                   = useState<Task[]>([]);
  const [newTaskText, setNewTaskText]       = useState("");
  const [isLoading, setIsLoading]           = useState(false);
  const [inputText, setInputText]           = useState("");
  const [activeCompanion, setActiveCompanion] = useState(COMPANIONS[0]);
  const [isTransitioning, setIsTransitioning] = useState(false);
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
  const [companionAnim, setCompanionAnim]   = useState<""|"bounce"|"spin"|"wave">("");
  const [quotaRemaining, setQuotaRemaining] = useState<number|null>(null);
  const [showQuotaWarn, setShowQuotaWarn]   = useState(false);
  const [activeKeyLabel, setActiveKeyLabel] = useState("");

  const prevLevelRef = useRef(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const greetingSetRef = useRef(false); // prevent double-greeting

  const { accent, accentRgb, theme } = activeCompanion;
  const level       = getLevelFromXP(xp);
  const nextLevelXP = getXPForLevel(level+1);
  const currLevelXP = getXPForLevel(level);
  const xpPct       = Math.min(100, ((xp-currLevelXP)/(nextLevelXP-currLevelXP))*100);
  const isEva = theme==="eva", isSpark = theme==="spark", isSquish = theme==="squish";

  // ── MOUNT + CLOCK ──────────────────────────────────────────────────────────
  useEffect(() => {
    setIsMounted(true);
    const tick = () => setCurrentTime(new Date().toLocaleTimeString("en-US",{hour12:false}));
    tick(); const iv = setInterval(tick,1000); return ()=>clearInterval(iv);
  },[]);

  // ── LOCAL STORAGE: XP / STREAK / COMPANION ────────────────────────────────
  useEffect(() => {
    const savedXP     = parseInt(localStorage.getItem("aegis_xp")||"0");
    const savedStreak = parseInt(localStorage.getItem("aegis_streak")||"1");
    const lastDate    = localStorage.getItem("aegis_last_date");
    const savedComp   = localStorage.getItem("aegis_companion");
    const today       = new Date().toDateString();
    const yesterday   = new Date(Date.now()-86400000).toDateString();
    setXP(savedXP); prevLevelRef.current = getLevelFromXP(savedXP);
    if (lastDate!==today) {
      const ns = lastDate===yesterday ? savedStreak+1 : lastDate ? 1 : savedStreak;
      setStreak(ns); localStorage.setItem("aegis_streak",String(ns)); localStorage.setItem("aegis_last_date",today);
    } else { setStreak(savedStreak); }
    if (savedComp) { const f=COMPANIONS.find(c=>c.id===savedComp); if(f)setActiveCompanion(f); }
  },[]);

  // ── XP WATCHER ─────────────────────────────────────────────────────────────
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

  // ── SESSION ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setAuthLoading(false);});
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,s)=>{setSession(s);setAuthLoading(false);});
    return ()=>subscription.unsubscribe();
  },[]);

  // ── DATA FETCH — always shows FRESH greeting, never old messages ───────────
  useEffect(() => {
    if (!session || greetingSetRef.current) return;
    greetingSetRef.current = true;
    (async () => {
      // Load profile
      const {data:pData} = await supabase.from("profiles").select("*").eq("id",session.user.id).single();
      if (pData) { setProfile(pData); setNameInput(pData.full_name||""); }

      // Load tasks
      const {data:tData} = await supabase.from("tasks").select("*").order("created_at",{ascending:true});
      if (tData) setTasks(tData);

      // ── ALWAYS show a fresh companion greeting on every load ───────────────
      // We do NOT load old messages into the main chat view.
      // Old messages are only accessible via the History sidebar.
      const name     = pData?.full_name || "Agent";
      const hour     = new Date().getHours();
      const tod      = hour<12?"morning":hour<18?"afternoon":"evening";
      const savedStr = parseInt(localStorage.getItem("aegis_streak")||"1");
      const pending  = (tData||[]).filter((t:Task)=>!t.completed).length;

      // Pick the companion that was saved (we already set it in the LS effect)
      const savedCompId = localStorage.getItem("aegis_companion");
      const companion   = COMPANIONS.find(c=>c.id===savedCompId) || COMPANIONS[0];

      const greetMsg = companion.greeting(name);
      const briefMsg = `Good ${tod}, ${name}! 🌅 You have ${(tData||[]).length} tasks (${pending} pending) · Streak: ${savedStr} days 🔥\n\n${greetMsg}`;

      setMessages([{ role:"assistant", content: briefMsg }]);
      setShowBriefing(true);
      playSound("briefing","squish");
      setTimeout(()=>setShowBriefing(false), 7000);
    })();
  },[session]);

  // ── COMPANION SWITCH ────────────────────────────────────────────────────────
  const switchCompanion = (c: typeof COMPANIONS[0]) => {
    if (c.id===activeCompanion.id) return;
    playSound("switch",c.theme); setIsTransitioning(true);
    setTimeout(()=>{ setActiveCompanion(c); localStorage.setItem("aegis_companion",c.id); setIsTransitioning(false); },380);
  };

  // ── PROFILE OPS ─────────────────────────────────────────────────────────────
  const saveName = async () => {
    if (!nameInput.trim()||!session) return;
    await supabase.from("profiles").update({full_name:nameInput.trim()}).eq("id",session.user.id);
    setProfile(p=>({...p,full_name:nameInput.trim()})); setEditingName(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file||!session) return;
    setAvatarUploading(true);
    try {
      const ext  = file.name.split(".").pop();
      const path = `avatars/${session.user.id}.${ext}`;
      const {error:upErr} = await supabase.storage.from("avatars").upload(path,file,{upsert:true});
      if (upErr) throw upErr;
      const {data} = supabase.storage.from("avatars").getPublicUrl(path);
      const url = data.publicUrl+"?t="+Date.now();
      await supabase.from("profiles").update({avatar_url:url}).eq("id",session.user.id);
      setProfile(p=>({...p,avatar_url:url}));
    } catch(err) {
      alert("Upload failed. Make sure you created the 'avatars' bucket in Supabase Storage with public access.");
    }
    setAvatarUploading(false);
  };

  // ── TASKS ───────────────────────────────────────────────────────────────────
  const handleAddTask = async () => {
    if (!newTaskText.trim()||!session) return;
    const {data,error} = await supabase.from("tasks").insert({
      text:newTaskText.trim(), category:"general", completed:false, user_id:session.user.id,
    }).select().single();
    if (!error&&data) { setTasks(p=>[...p,data]); setNewTaskText(""); addXP(25); }
  };

  const handleToggleTask = async (task:Task) => {
    await supabase.from("tasks").update({completed:!task.completed}).eq("id",task.id);
    setTasks(p=>p.map(t=>t.id===task.id?{...t,completed:!t.completed}:t));
  };

  // ── POKE ─────────────────────────────────────────────────────────────────────
  const handlePoke = () => {
    playSound("poke",theme); setLastPoke(Date.now()); triggerAnim("bounce"); addXP(2);
    setPokeCount(p=>{
      const n=p+1;
      if(n>=5){
        handleSendMessage(
          activeCompanion.id==="eva"?"Touch sensors malfunctioning. Cease contact.":
          activeCompanion.id==="spark"?"STOPPP ITTTTT 😤 (ok that was kinda funny tho)":
          "Hey! That tickles! Stop poking me! 😅",false
        ); return 0;
      }
      return n;
    });
  };

  const triggerAnim = (a:"bounce"|"spin"|"wave")=>{setCompanionAnim(a);setTimeout(()=>setCompanionAnim(""),700);};

  // ── VOICE ─────────────────────────────────────────────────────────────────────
  const startListening = () => {
    playSound("click",theme);
    const SR=(window as any).webkitSpeechRecognition||(window as any).SpeechRecognition;
    if(!SR)return;
    const rec=new SR();
    rec.onstart=()=>setIsListening(true);
    rec.onresult=(e:any)=>{ const t=e.results[0][0].transcript; handleSendMessage(t.toLowerCase().includes("wake up")?`Protocols initiated. ${activeCompanion.name} is online.`:t); };
    rec.onend=()=>setIsListening(false);
    rec.start();
  };

  // ── SEND ─────────────────────────────────────────────────────────────────────
  const handleSendMessage = async (override?:string, isSilent=false) => {
    const text=override||inputText;
    if(!text.trim())return;
    playSound("send",theme); setIsLoading(true);
    if(!override)setInputText("");
    const mood=detectMood(text);
    if(mood!=="neutral"&&mood!==currentMood){
      setCurrentMood(mood);
      const opts=activeCompanion.moodKeywords[mood];
      setMoodMessage(opts[Math.floor(Math.random()*opts.length)]);
      setShowMoodBanner(true); setTimeout(()=>setShowMoodBanner(false),4200);
    }
    try {
      const res=await fetch("/api/chat",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:text,companionId:activeCompanion.id,chatHistory:messages.slice(-5),userProfile:profile,currentMood:mood}),
      });
      const data=await res.json();
      setMessages(p=>[...p,{role:"user",content:text},{role:"assistant",content:data.reply}]);
      addXP(10); triggerAnim("wave");
      if(!isSilent)speakText(data.reply,activeCompanion);
    } catch(e){console.error(e);}
    finally{setIsLoading(false);}
  };

  // ── TTS + QUOTA ───────────────────────────────────────────────────────────────
  const speakText = async (text:string, c:typeof COMPANIONS[0]) => {
    const clean=text.replace(/\[.*?\]/g,"").replace(/[*_#`~]/g,"").trim().slice(0,500);
    try {
      const res=await fetch("/api/tts",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({text:clean,voiceId:c.voiceId}),
      });
      // Read quota headers
      const rem=res.headers.get("X-EL-Remaining");
      const keyLbl=res.headers.get("X-EL-Key")||"";
      if(rem){ const r=parseInt(rem); setQuotaRemaining(r); setActiveKeyLabel(keyLbl); if(r<QUOTA_WARN&&r>0){setShowQuotaWarn(true);setTimeout(()=>setShowQuotaWarn(false),6000);} }
      if(!res.ok||res.headers.get("content-type")?.includes("json")){browserTTS(clean,c.id);return;}
      const ct=res.headers.get("content-type")||"";
      if(ct.includes("audio")){
        const blob=await res.blob(); const url=URL.createObjectURL(blob); const audio=new Audio(url);
        if(c.id==="eva")audio.playbackRate=0.85;
        if(c.id==="spark")audio.playbackRate=1.15;
        audio.onended=()=>URL.revokeObjectURL(url); await audio.play();
      } else { browserTTS(clean,c.id); }
    } catch { browserTTS(clean,c.id); }
  };

  const browserTTS = (text:string, id:string) => {
    if(!window.speechSynthesis)return;
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    const voices=window.speechSynthesis.getVoices();
    if(id==="eva")  {u.rate=0.82;u.pitch=0.65;const v=voices.find(v=>/daniel|george|male|uk/i.test(v.name));if(v)u.voice=v;}
    if(id==="spark"){u.rate=1.2; u.pitch=1.75;const v=voices.find(v=>/samantha|zira|female/i.test(v.name));if(v)u.voice=v;}
    else            {u.rate=1.0; u.pitch=1.2;}
    window.speechSynthesis.speak(u);
  };

  // ── GUARDS ───────────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{height:"100vh",background:"#050508",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"16px"}}>
      <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{animation:"spin-slow 3s linear infinite"}}>
        <polygon points="50,4 93,27.5 93,72.5 50,96 7,72.5 7,27.5" stroke="#F59E0B" strokeWidth="2.5" fill="none"/>
        <circle cx="50" cy="50" r="14" stroke="#F59E0B" strokeWidth="2" fill="none"/>
        <circle cx="50" cy="50" r="6" fill="#F59E0B"/>
      </svg>
      <p style={{fontFamily:"monospace",fontSize:"11px",color:"#F59E0B",letterSpacing:".35em"}}>INITIALIZING AEGIS...</p>
      <style>{`@keyframes spin-slow{to{transform:rotate(360deg)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!session) return <Auth />;

  const lastMsg = messages.slice().reverse().find(m=>m.role==="assistant")?.content || "Ready for input.";
  const userEmail = session?.user?.email || "";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Bubblegum+Sans&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{overflow:hidden}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes spin-slow{to{transform:rotate(360deg)}}
        @keyframes pg{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes ap{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
        @keyframes bd{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
        @keyframes msa{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mbi{from{opacity:0;transform:translateX(-50%) translateY(-16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes mbo{to{opacity:0;transform:translateX(-50%) translateY(-16px)}}
        @keyframes bc{from{opacity:0;transform:translateX(-50%) scale(.8)}to{opacity:1;transform:translateX(-50%) scale(1)}}
        @keyframes fl{0%{opacity:0}50%{opacity:1}100%{opacity:0}}
        @keyframes lu{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}15%{opacity:1;transform:translate(-50%,-62%) scale(1.1)}85%{opacity:1;transform:translate(-50%,-62%) scale(1)}100%{opacity:0;transform:translate(-50%,-80%) scale(.9)}}
        @keyframes cab{0%,100%{transform:translateY(0)}35%{transform:translateY(-22px)}65%{transform:translateY(-8px)}}
        @keyframes caw{0%,100%{transform:rotate(0)}25%{transform:rotate(-9deg)}75%{transform:rotate(9deg)}}
        @keyframes cas{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes fl1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-15px,20px) scale(1.04)}}
        @keyframes fl2{0%,100%{transform:translate(0,0)}50%{transform:translate(12px,-15px)}}
        @keyframes sdrift{from{background-position:0 0}to{background-position:30px 30px}}
        @keyframes rr{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(360deg)}}
        @keyframes sw{0%{top:15%;opacity:0}10%{opacity:1}90%{opacity:1}100%{top:85%;opacity:0}}
        @keyframes stfloat{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-14px) rotate(18deg)}}

        .ca-bounce{animation:cab .6s cubic-bezier(.36,.07,.19,.97)}
        .ca-wave{animation:caw .6s ease-in-out}
        .ca-spin{animation:cas .7s ease-in-out}
        .msg-anim{animation:msa .35s ease}
        .dots{display:inline-flex;gap:3px;align-items:center}
        .dots span{width:5px;height:5px;border-radius:50%;background:currentColor;animation:bd 1.2s infinite}
        .dots span:nth-child(2){animation-delay:.2s}.dots span:nth-child(3){animation-delay:.4s}
        .cbn{width:36px;height:36px;border-radius:50%;border:2px solid transparent;transition:all .3s;cursor:pointer}
        .cbn.on{border-color:white;transform:scale(1.2)}
        .cbn:not(.on){opacity:.3;filter:grayscale(40%)}
        .cbn:not(.on):hover{opacity:.65;transform:scale(1.05)}
        .lup{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;pointer-events:none;animation:lu 3.5s ease forwards}
        .mb{position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:200;pointer-events:none;animation:mbi .4s ease,mbo .4s ease 3.8s forwards;white-space:nowrap}
        .briefcard{position:absolute;top:60px;left:50%;transform:translateX(-50%);z-index:300;width:min(400px,90vw);animation:bc .5s cubic-bezier(.34,1.56,.64,1)}
        .flash{position:fixed;inset:0;z-index:9998;pointer-events:none;animation:fl .4s ease}
        .aura{position:absolute;inset:-20%;border-radius:50%;pointer-events:none;animation:ap 3s ease-in-out infinite}
        .panel{position:fixed;top:0;height:100%;width:320px;z-index:110;transition:transform .4s cubic-bezier(.23,1,.32,1);border-style:solid;border-width:0}
        .panel.left{left:0;border-right-width:1px}
        .panel.right{right:0;border-left-width:1px}
        .hs{scrollbar-width:none}.hs::-webkit-scrollbar{display:none}
        .mic.on{border-color:#EF4444!important;background:rgba(239,68,68,.14)!important;color:#EF4444!important;animation:pg 1s infinite}
        .avatar-wrap{position:relative;cursor:pointer}
        .avatar-overlay{position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;font-size:18px}
        .avatar-wrap:hover .avatar-overlay{opacity:1}
        .quota-toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:9000;pointer-events:none;animation:mbi .4s ease,mbo .4s ease 5.6s forwards;white-space:nowrap}
        .quota-inner{padding:10px 20px;border-radius:12px;background:rgba(239,68,68,.12);border:1.5px solid rgba(239,68,68,.5);font-family:'Share Tech Mono',monospace;font-size:10px;color:#FCA5A5;letter-spacing:.08em;display:flex;align-items:center;gap:8px}

        /* ═══ SQUISH ═══ */
        .t-squish{background:linear-gradient(145deg,#FFFBEB 0%,#FEF3C7 60%,#FDE68A 100%);font-family:'Fredoka',sans-serif}
        .t-squish .btn{background:rgba(255,255,255,.75);border:2px solid rgba(245,158,11,.3);color:#92400E;border-radius:50px;padding:8px 18px;font-family:'Fredoka',sans-serif;font-weight:600;font-size:13px;cursor:pointer;transition:all .2s}
        .t-squish .btn:hover{background:white;border-color:#F59E0B;transform:scale(1.05) translateY(-1px)}
        .t-squish .btn.red{color:#DC2626;border-color:rgba(220,38,38,.3)}
        .t-squish .card{background:rgba(255,255,255,.88);border-radius:32px;border:2px solid rgba(245,158,11,.25);box-shadow:0 8px 40px rgba(245,158,11,.12),0 2px 8px rgba(0,0,0,.04);backdrop-filter:blur(16px)}
        .t-squish .bar{background:rgba(255,255,255,.92);border-radius:50px;border:2px solid rgba(245,158,11,.35);box-shadow:0 4px 20px rgba(245,158,11,.12)}
        .t-squish .txt-main{font-family:'Fredoka',sans-serif;font-size:16px;font-weight:500;color:#374151;text-align:center;line-height:1.65}
        .t-squish .input{font-family:'Fredoka',sans-serif;font-size:15px;color:#78350F;background:transparent;border:none;outline:none;width:100%}
        .t-squish .input::placeholder{color:rgba(120,53,15,.35)}
        .t-squish .sbtn{background:#F59E0B;color:white;border:none;border-radius:40px;padding:10px 26px;font-family:'Fredoka',sans-serif;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 12px rgba(245,158,11,.35);transition:all .2s;white-space:nowrap}
        .t-squish .sbtn:hover{background:#D97706;transform:scale(1.05)}
        .t-squish .mic{background:rgba(245,158,11,.1);border:2px solid rgba(245,158,11,.3);border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;flex-shrink:0;transition:all .2s}
        .t-squish .chip{background:rgba(255,255,255,.8);border-radius:20px;border:1.5px solid rgba(245,158,11,.25);padding:5px 14px;display:flex;align-items:center;gap:6px}
        .t-squish .chip-l{font-family:'Fredoka',sans-serif;font-size:11px;color:rgba(120,53,15,.45)}
        .t-squish .chip-v{font-family:'Fredoka',sans-serif;font-size:14px;font-weight:600;color:#92400E}
        .t-squish .xpbg{background:rgba(245,158,11,.15);border-radius:10px;height:5px}
        .t-squish .xpfg{background:linear-gradient(90deg,#F59E0B,#FCD34D);border-radius:10px;height:100%;transition:width .8s cubic-bezier(.34,1.56,.64,1)}
        .t-squish .sbar{background:rgba(255,251,235,.85);border-bottom:1.5px solid rgba(245,158,11,.2)}
        .t-squish .stxt{font-family:'Fredoka',sans-serif;font-size:13px;color:rgba(120,53,15,.55)}
        .t-squish .dot{background:#F59E0B;box-shadow:0 0 8px rgba(245,158,11,.9)}
        .t-squish .panel{background:rgba(255,251,235,.97);border-color:rgba(245,158,11,.2)}
        .t-squish .ptitle{font-family:'Fredoka',sans-serif;font-size:22px;font-weight:700;color:#92400E}
        .t-squish .muser{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);border-radius:16px}
        .t-squish .mbot{background:white;border:1px solid rgba(245,158,11,.12);border-radius:16px}
        .t-squish .aura{background:radial-gradient(ellipse,rgba(245,158,11,.14) 0%,transparent 70%)}
        .t-squish .task-input{color:#78350F;border-bottom-color:rgba(245,158,11,.4);font-family:'Fredoka',sans-serif}
        .t-squish .name-edit{color:#92400E;border-bottom-color:#F59E0B;font-family:'Fredoka',sans-serif}
        .sq-b1{position:fixed;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(251,191,36,.1) 0%,transparent 70%);top:-40px;right:-40px;pointer-events:none;animation:fl1 7s ease-in-out infinite}
        .sq-b2{position:fixed;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(245,158,11,.07) 0%,transparent 70%);bottom:80px;left:-20px;pointer-events:none;animation:fl2 9s ease-in-out infinite}

        /* ═══ SPARK ═══ */
        .t-spark{background:linear-gradient(135deg,#FFF0F6 0%,#FCE4EC 50%,#F8BBD0 100%);font-family:'Bubblegum Sans',cursive}
        .t-spark::before{content:'';position:fixed;inset:0;pointer-events:none;background-image:radial-gradient(circle,rgba(236,72,153,.07) 1.5px,transparent 1.5px);background-size:30px 30px;animation:sdrift 25s linear infinite;z-index:0}
        .t-spark .btn{background:rgba(255,255,255,.78);border:2.5px solid rgba(236,72,153,.35);color:#9D174D;border-radius:18px;padding:8px 16px;font-family:'Bubblegum Sans',cursive;font-size:13px;cursor:pointer;transition:all .15s;transform:rotate(-1deg)}
        .t-spark .btn:hover{background:white;border-color:#EC4899;transform:rotate(1deg) scale(1.08)}
        .t-spark .btn.red{color:#DC2626;border-color:rgba(220,38,38,.3);transform:rotate(.5deg)}
        .t-spark .card{background:rgba(255,255,255,.9);border-radius:28px;border:2.5px solid rgba(236,72,153,.3);box-shadow:4px 4px 0 rgba(236,72,153,.18),0 8px 30px rgba(236,72,153,.1);backdrop-filter:blur(16px);transform:rotate(-.4deg)}
        .t-spark .bar{background:rgba(255,255,255,.92);border-radius:22px;border:2.5px solid rgba(236,72,153,.45);box-shadow:3px 3px 0 rgba(236,72,153,.18)}
        .t-spark .txt-main{font-family:'Bubblegum Sans',cursive;font-size:17px;color:#374151;text-align:center;line-height:1.65}
        .t-spark .input{font-family:'Bubblegum Sans',cursive;font-size:15px;color:#831843;background:transparent;border:none;outline:none;width:100%}
        .t-spark .input::placeholder{color:rgba(131,24,67,.32)}
        .t-spark .sbtn{background:linear-gradient(135deg,#EC4899,#F472B6);color:white;border:none;border-radius:18px;padding:10px 22px;font-family:'Bubblegum Sans',cursive;font-size:14px;cursor:pointer;box-shadow:3px 3px 0 rgba(236,72,153,.3);transition:all .15s;white-space:nowrap}
        .t-spark .sbtn:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 rgba(236,72,153,.3)}
        .t-spark .mic{background:rgba(236,72,153,.1);border:2px solid rgba(236,72,153,.35);border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;flex-shrink:0;transition:all .15s}
        .t-spark .chip{background:rgba(255,255,255,.82);border-radius:14px;border:2px solid rgba(236,72,153,.22);padding:5px 14px;display:flex;align-items:center;gap:6px;box-shadow:2px 2px 0 rgba(236,72,153,.12)}
        .t-spark .chip-l{font-family:'Bubblegum Sans',cursive;font-size:10px;color:rgba(157,23,77,.5)}
        .t-spark .chip-v{font-family:'Bubblegum Sans',cursive;font-size:14px;color:#9D174D}
        .t-spark .xpbg{background:rgba(236,72,153,.12);border-radius:10px;height:5px}
        .t-spark .xpfg{background:linear-gradient(90deg,#EC4899,#F472B6,#FB7185);border-radius:10px;height:100%;transition:width .8s cubic-bezier(.34,1.56,.64,1)}
        .t-spark .sbar{background:rgba(255,240,246,.9);border-bottom:2px solid rgba(236,72,153,.2)}
        .t-spark .stxt{font-family:'Bubblegum Sans',cursive;font-size:13px;color:rgba(157,23,77,.6)}
        .t-spark .dot{background:#EC4899;box-shadow:0 0 8px rgba(236,72,153,1)}
        .t-spark .panel{background:rgba(255,240,246,.97);border-color:rgba(236,72,153,.2)}
        .t-spark .ptitle{font-family:'Bubblegum Sans',cursive;font-size:22px;color:#9D174D}
        .t-spark .muser{background:rgba(236,72,153,.08);border:1px solid rgba(236,72,153,.2);border-radius:16px}
        .t-spark .mbot{background:white;border:1px solid rgba(236,72,153,.15);border-radius:16px}
        .t-spark .aura{background:radial-gradient(ellipse,rgba(236,72,153,.12) 0%,transparent 70%)}
        .t-spark .task-input{color:#831843;border-bottom-color:rgba(236,72,153,.4);font-family:'Bubblegum Sans',cursive}
        .t-spark .name-edit{color:#9D174D;border-bottom-color:#EC4899;font-family:'Bubblegum Sans',cursive}
        .sp-star{position:fixed;pointer-events:none;animation:stfloat 4s ease-in-out infinite}

        /* ═══ EVA ═══ */
        .t-eva{background:#050508;font-family:'Rajdhani',sans-serif}
        .t-eva::before{content:'';position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(100,116,139,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(100,116,139,.03) 1px,transparent 1px);background-size:40px 40px}
        .t-eva::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.06) 2px,rgba(0,0,0,.06) 4px)}
        .t-eva .btn{background:rgba(255,255,255,.04);border:1px solid rgba(100,116,139,.28);color:rgba(255,255,255,.45);border-radius:3px;padding:7px 14px;font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:.15em;cursor:pointer;transition:all .2s;text-transform:uppercase}
        .t-eva .btn:hover{border-color:rgba(100,116,139,.6);color:#94A3B8;background:rgba(100,116,139,.06)}
        .t-eva .btn.red{color:rgba(239,68,68,.55);border-color:rgba(239,68,68,.2)}
        .t-eva .btn.red:hover{color:#EF4444;border-color:rgba(239,68,68,.5)}
        .t-eva .card{background:rgba(0,0,0,.78);border-radius:14px;border:1px solid rgba(100,116,139,.22);box-shadow:0 0 40px rgba(100,116,139,.07),inset 0 1px 0 rgba(100,116,139,.08);backdrop-filter:blur(20px)}
        .t-eva .bar{background:rgba(0,0,0,.85);border-radius:8px;border:1px solid rgba(100,116,139,.28)}
        .t-eva .txt-main{font-family:'Rajdhani',sans-serif;font-size:14px;color:rgba(255,255,255,.82);text-align:left;line-height:1.7;letter-spacing:.02em}
        .t-eva .input{font-family:'Rajdhani',sans-serif;font-size:15px;color:white;background:transparent;border:none;outline:none;width:100%;letter-spacing:.04em}
        .t-eva .input::placeholder{color:rgba(255,255,255,.18)}
        .t-eva .sbtn{background:#475569;color:white;border:none;border-radius:4px;padding:10px 24px;font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:.18em;cursor:pointer;transition:all .2s;text-transform:uppercase;white-space:nowrap;clip-path:polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)}
        .t-eva .sbtn:hover{background:#64748B;box-shadow:0 0 20px rgba(100,116,139,.4)}
        .t-eva .mic{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:16px;color:rgba(255,255,255,.35);cursor:pointer;flex-shrink:0;transition:all .2s}
        .t-eva .chip{background:rgba(100,116,139,.06);border-radius:3px;border:1px solid rgba(100,116,139,.18);padding:5px 10px;display:flex;align-items:center;gap:6px}
        .t-eva .chip-l{font-family:'Share Tech Mono',monospace;font-size:8px;color:rgba(255,255,255,.22);letter-spacing:.14em}
        .t-eva .chip-v{font-family:'Share Tech Mono',monospace;font-size:11px;color:#94A3B8}
        .t-eva .xpbg{background:rgba(100,116,139,.1);border-radius:2px;height:3px}
        .t-eva .xpfg{background:linear-gradient(90deg,#475569,#94A3B8);border-radius:2px;height:100%;transition:width .8s cubic-bezier(.34,1.56,.64,1)}
        .t-eva .sbar{background:rgba(100,116,139,.05);border-bottom:1px solid rgba(100,116,139,.18)}
        .t-eva .stxt{font-family:'Share Tech Mono',monospace;font-size:9px;color:rgba(100,116,139,.7);letter-spacing:.18em;text-transform:uppercase}
        .t-eva .dot{background:#64748B;box-shadow:0 0 8px rgba(100,116,139,.9)}
        .t-eva .panel{background:rgba(0,0,0,.94);border-color:rgba(100,116,139,.18)}
        .t-eva .ptitle{font-family:'Share Tech Mono',monospace;font-size:12px;color:#64748B;letter-spacing:.2em;text-transform:uppercase}
        .t-eva .muser{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:6px}
        .t-eva .mbot{background:rgba(100,116,139,.05);border:1px solid rgba(100,116,139,.12);border-radius:6px}
        .t-eva .aura{background:radial-gradient(ellipse,rgba(100,116,139,.09) 0%,transparent 70%)}
        .t-eva .task-input{color:white;border-bottom-color:rgba(100,116,139,.4);font-family:'Share Tech Mono',monospace;font-size:11px}
        .t-eva .name-edit{color:white;border-bottom-color:#64748B;font-family:'Share Tech Mono',monospace;font-size:13px}
        .eva-r{position:fixed;border-radius:50%;border:1px solid rgba(100,116,139,.1);pointer-events:none;top:50%;left:50%}
        .eva-r1{width:680px;height:680px;transform:translate(-50%,-50%);animation:rr 24s linear infinite}
        .eva-r2{width:500px;height:500px;transform:translate(-50%,-50%);animation:rr 17s linear infinite reverse;border-style:dashed}
        .eva-sw{position:fixed;left:0;right:0;height:1px;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(100,116,139,.35),transparent);animation:sw 5s ease-in-out infinite}

        /* shared task/name inputs */
        .task-input{background:transparent;border:none;border-bottom:1.5px solid;outline:none;flex:1;padding:4px 6px;font-size:13px}
        .name-edit{background:transparent;border:none;border-bottom:2px solid;outline:none;font-weight:700;font-size:17px;text-align:center;width:100%;padding:2px 4px}
      `}</style>

      <div className={`t-${theme}`} style={{height:"100vh",width:"100%",overflow:"hidden",position:"relative"}}>

        {/* ── THEME DECO ── */}
        {isEva   && <><div className="eva-r eva-r1"/><div className="eva-r eva-r2"/><div className="eva-sw"/></>}
        {isSquish && <><div className="sq-b1"/><div className="sq-b2"/></>}
        {isSpark  && ["✦","★","✸","💖","✨","🌸","⬡"].map((s,i)=>(
          <div key={i} className="sp-star" style={{left:i<4?`${8+i*18}%`:undefined,right:i>=4?`${5+(i-4)*18}%`:undefined,top:i<4?`${4+(i%3)*7}%`:`${12+(i-4)*8}%`,fontSize:s.length>1?"15px":"18px",animationDelay:`${i*.65}s`,opacity:.3,color:i%2===0?"#EC4899":"#F472B6"}}>{s}</div>
        ))}

        {isTransitioning && <div className="flash" style={{background:`rgba(${accentRgb},.12)`}}/>}
        <AppDownloadBanner />

        {/* LEVEL UP */}
        {showLevelUp && (
          <div className="lup">
            <div style={{padding:"18px 36px",borderRadius:isEva?"8px":"24px",background:isEva?"rgba(0,0,0,.92)":"rgba(255,255,255,.96)",border:`2px solid ${accent}`,boxShadow:`0 0 40px rgba(${accentRgb},.5)`,textAlign:"center"}}>
              <div style={{fontSize:"30px",marginBottom:"6px"}}>🏆</div>
              <div style={{fontFamily:isEva?"Share Tech Mono,monospace":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif",fontSize:isEva?"13px":"18px",color:accent,fontWeight:700}}>
                {isSpark?`LEVEL ${levelUpNum} UNLOCKED!! 🎉`:isEva?`LEVEL_${levelUpNum}_REACHED`:`Level ${levelUpNum} reached! ✨`}
              </div>
              <div style={{fontFamily:"monospace",fontSize:"10px",color:isEva?"rgba(255,255,255,.35)":"rgba(0,0,0,.35)",marginTop:"4px"}}>{xp} XP TOTAL</div>
            </div>
          </div>
        )}

        {/* MOOD BANNER */}
        {showMoodBanner && (
          <div className="mb">
            <div style={{padding:"9px 20px",borderRadius:isEva?"4px":"20px",background:isEva?"rgba(0,0,0,.88)":"rgba(255,255,255,.93)",border:`1.5px solid rgba(${accentRgb},.5)`,fontSize:isEva?"10px":"13px",fontFamily:isEva?"Share Tech Mono,monospace":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif",color:isEva?accent:"#374151",display:"flex",alignItems:"center",gap:"8px"}}>
              <span style={{fontSize:"16px"}}>{currentMood==="stressed"?"💛":currentMood==="happy"?"🎉":"🎯"}</span>
              {moodMessage}
            </div>
          </div>
        )}

        {/* QUOTA TOAST */}
        {showQuotaWarn && quotaRemaining!==null && (
          <div className="quota-toast">
            <div className="quota-inner">
              <span>⚠️</span>
              Voice quota low — {quotaRemaining.toLocaleString()} chars left {activeKeyLabel?`(${activeKeyLabel})`:""}.
              Browser voice will kick in when exhausted.
            </div>
          </div>
        )}

        {/* ══ HISTORY PANEL ══ */}
        <div className={`panel left ${isHistoryOpen?"translate-x-0":"-translate-x-full"}`} style={{borderColor:`rgba(${accentRgb},.2)`}}>
          <div className="panel" style={{position:"static",padding:"24px",height:"100%",display:"flex",flexDirection:"column",background:"inherit"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"18px",alignItems:"flex-start"}}>
              <div><div className="ptitle">{isEva?"SYNC_LOGS":isSpark?"💬 History!!":"Chat History"}</div>
                <div style={{fontFamily:"monospace",fontSize:"10px",opacity:.35,marginTop:"2px"}}>{messages.length} entries</div></div>
              <button onClick={()=>setIsHistoryOpen(false)} className="btn">✕</button>
            </div>
            <div className="hs" style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:"8px"}}>
              {messages.map((m,i)=>(
                <div key={i} className={m.role==="user"?"muser":"mbot"} style={{padding:"10px 14px"}}>
                  <div style={{fontFamily:"monospace",fontSize:"9px",opacity:.35,marginBottom:"4px",textTransform:"uppercase"}}>{m.role==="user"?"▶ You":`◆ ${activeCompanion.name}`}</div>
                  <div style={{fontSize:"12px",lineHeight:1.5,opacity:.75}}>{m.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ GOALS PANEL ══ */}
        <div className={`panel left ${isTaskOpen?"translate-x-0":"-translate-x-full"}`} style={{borderColor:`rgba(${accentRgb},.2)`,zIndex:120}}>
          <div className="panel" style={{position:"static",padding:"24px",height:"100%",display:"flex",flexDirection:"column",background:"inherit"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"18px",alignItems:"flex-start"}}>
              <div><div className="ptitle">{isEva?"OBJECTIVE_MATRIX":isSpark?"🎯 Goals!!":"My Goals 🎯"}</div>
                <div style={{fontFamily:"monospace",fontSize:"10px",opacity:.35,marginTop:"2px"}}>{tasks.filter(t=>t.completed).length}/{tasks.length} done</div></div>
              <button onClick={()=>setIsTaskOpen(false)} className="btn">✕</button>
            </div>
            <div className="hs" style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:"8px"}}>
              {tasks.length===0
                ?<div style={{textAlign:"center",padding:"40px 0",opacity:.25,fontFamily:"monospace",fontSize:"12px"}}>No objectives yet</div>
                :tasks.map(t=>(
                  <div key={t.id} className="mbot" style={{padding:"12px 14px",cursor:"pointer",opacity:t.completed?.65:1}} onClick={()=>handleToggleTask(t)}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <div style={{width:"16px",height:"16px",borderRadius:"50%",border:`2px solid rgba(${accentRgb},.5)`,background:t.completed?accent:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",color:"black"}}>{t.completed?"✓":""}</div>
                      <div style={{fontSize:"13px",fontWeight:600,opacity:.8,textDecoration:t.completed?"line-through":"none"}}>{t.text}</div>
                    </div>
                  </div>
                ))}
            </div>
            <div style={{marginTop:"12px",display:"flex",gap:"8px",alignItems:"center",borderTop:`1px solid rgba(${accentRgb},.15)`,paddingTop:"12px"}}>
              <input className={`task-input ${isEva?"t-eva":isSpark?"t-spark":"t-squish"} task-input`}
                placeholder={isEva?"Enter objective...":isSpark?"New goal!! ✨":"Add a goal..."}
                value={newTaskText} onChange={e=>setNewTaskText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAddTask()}
                style={{color:isEva?"white":isSpark?"#831843":"#78350F",borderBottomColor:isEva?"rgba(100,116,139,.4)":isSpark?"rgba(236,72,153,.4)":"rgba(245,158,11,.4)",fontFamily:isEva?"Share Tech Mono,monospace":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif"}}/>
              <button className="sbtn" style={{padding:"8px 14px",borderRadius:isEva?"4px":"16px",fontSize:"12px"}} onClick={handleAddTask}>+</button>
            </div>
          </div>
        </div>

        {/* ══ PROFILE PANEL ══ */}
        <div className={`panel right ${isProfileOpen?"translate-x-0":"translate-x-full"}`} style={{borderColor:`rgba(${accentRgb},.2)`}}>
          <div className="panel" style={{position:"static",padding:"24px",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",background:"inherit",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",width:"100%",marginBottom:"22px"}}>
              <div className="ptitle">{isEva?"AGENT_STATS":isSpark?"✨ My Stats!!":"My Stats 👤"}</div>
              <button onClick={()=>setIsProfileOpen(false)} className="btn">✕</button>
            </div>

            {/* AVATAR */}
            <div className="avatar-wrap" style={{marginBottom:"8px"}} onClick={()=>fileInputRef.current?.click()}>
              <div style={{width:"80px",height:"80px",borderRadius:"50%",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",background:`rgba(${accentRgb},.1)`,border:`2px solid rgba(${accentRgb},.5)`,boxShadow:`0 0 20px rgba(${accentRgb},.22)`}}>
                {avatarUploading
                  ?<div style={{width:"24px",height:"24px",border:`2px solid rgba(${accentRgb},.3)`,borderTop:`2px solid ${accent}`,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
                  :profile.avatar_url
                  ?<img src={profile.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  :<span style={{fontSize:"34px"}}>👤</span>}
              </div>
              <div className="avatar-overlay">📷</div>
              <div className="dot" style={{position:"absolute",bottom:2,right:2,width:"10px",height:"10px",borderRadius:"50%"}}/>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarUpload}/>
            <div style={{fontFamily:"monospace",fontSize:"8px",opacity:.25,marginBottom:"10px"}}>
              {isEva?"CLICK TO UPLOAD AVATAR":"tap to change photo"}
            </div>

            {/* EDITABLE NAME */}
            {editingName?(
              <div style={{width:"100%",display:"flex",gap:"6px",alignItems:"center",marginBottom:"4px"}}>
                <input className="name-edit"
                  value={nameInput} onChange={e=>setNameInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")saveName();if(e.key==="Escape")setEditingName(false);}}
                  autoFocus
                  style={{color:isEva?"white":isSpark?"#9D174D":"#92400E",borderBottomColor:accent,fontFamily:isEva?"Share Tech Mono,monospace":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif"}}/>
                <button className="sbtn" style={{padding:"6px 12px",fontSize:"11px",borderRadius:"8px"}} onClick={saveName}>✓</button>
              </div>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"4px",cursor:"pointer"}} onClick={()=>setEditingName(true)}>
                <div style={{fontFamily:isEva?"Share Tech Mono,monospace":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif",fontSize:"17px",fontWeight:700,color:accent}}>
                  {profile.full_name||"AGENT"}
                </div>
                <span style={{fontSize:"12px",opacity:.4}}>✏️</span>
              </div>
            )}

            {/* EMAIL */}
            <div style={{fontFamily:"monospace",fontSize:"10px",opacity:.4,marginBottom:"4px",textAlign:"center",wordBreak:"break-all",maxWidth:"100%"}}>{userEmail}</div>
            <div style={{fontFamily:"monospace",fontSize:"9px",opacity:.25,textTransform:"uppercase",marginBottom:"18px"}}>{profile.persona||"GENERAL"}</div>

            {/* XP BAR */}
            <div style={{width:"100%",marginBottom:"18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
                <span style={{fontFamily:"monospace",fontSize:"10px",color:accent}}>LVL {level}</span>
                <span style={{fontFamily:"monospace",fontSize:"9px",opacity:.35}}>{xp}/{nextLevelXP} XP</span>
              </div>
              <div className="xpbg"><div className="xpfg" style={{width:`${xpPct}%`}}/></div>
            </div>

            {/* STATS GRID */}
            <div style={{width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"7px",marginBottom:"14px"}}>
              {[{l:"LEVEL",v:level},{l:"STREAK",v:`${streak}🔥`},{l:"TASKS",v:`${tasks.filter(t=>t.completed).length}/${tasks.length}`},{l:"POKES",v:pokeCount},{l:"MSGS",v:messages.length},{l:"XP",v:xp}].map((s,i)=>(
                <div key={i} className="chip" style={{justifyContent:"space-between"}}>
                  <span className="chip-l">{s.l}</span><span className="chip-v">{s.v}</span>
                </div>
              ))}
            </div>

            {/* COMPANION PREF */}
            <div style={{width:"100%",padding:"12px",borderRadius:"12px",background:`rgba(${accentRgb},.06)`,border:`1px solid rgba(${accentRgb},.18)`,marginBottom:"14px"}}>
              <div style={{fontFamily:"monospace",fontSize:"8px",opacity:.35,textTransform:"uppercase",marginBottom:"8px"}}>DEFAULT COMPANION</div>
              <div style={{display:"flex",gap:"10px",justifyContent:"center",marginBottom:"6px"}}>
                {COMPANIONS.map(c=>(
                  <button key={c.id} onClick={()=>switchCompanion(c)} className={`cbn ${activeCompanion.id===c.id?"on":""} ${c.color}`}
                    style={{boxShadow:activeCompanion.id===c.id?`0 0 12px rgba(${c.accentRgb},.7)`:undefined}}/>
                ))}
              </div>
              <div style={{fontFamily:"Share Tech Mono,monospace",fontSize:"8px",opacity:.4,textTransform:"uppercase",textAlign:"center",letterSpacing:".12em"}}>
                SAVED: {activeCompanion.name.toUpperCase()}
              </div>
            </div>

            {/* QUOTA */}
            {quotaRemaining!==null && (
              <div style={{width:"100%",padding:"10px 12px",borderRadius:"8px",background:quotaRemaining<QUOTA_WARN?"rgba(239,68,68,.08)":"rgba(34,197,94,.06)",border:`1px solid ${quotaRemaining<QUOTA_WARN?"rgba(239,68,68,.3)":"rgba(34,197,94,.25)"}`,marginBottom:"12px"}}>
                <div style={{fontFamily:"monospace",fontSize:"8px",opacity:.4,textTransform:"uppercase",marginBottom:"4px"}}>VOICE QUOTA {activeKeyLabel?`(${activeKeyLabel})`:""}</div>
                <div style={{fontFamily:"Share Tech Mono,monospace",fontSize:"12px",color:quotaRemaining<QUOTA_WARN?"#FCA5A5":"#86EFAC"}}>{quotaRemaining.toLocaleString()} chars remaining</div>
              </div>
            )}

            <button onClick={()=>supabase.auth.signOut()} className="btn red" style={{marginTop:"auto",width:"100%",textAlign:"center",padding:"12px"}}>⏻ SIGN OUT</button>
          </div>
        </div>

        {/* BACKDROP */}
        {(isTaskOpen||isHistoryOpen||isProfileOpen)&&(
          <div onClick={()=>{setIsTaskOpen(false);setIsHistoryOpen(false);setIsProfileOpen(false);}}
            style={{position:"fixed",inset:0,zIndex:90,background:"rgba(0,0,0,.28)",backdropFilter:"blur(4px)"}}/>
        )}

        {/* ══ MAIN ══ */}
        <main style={{height:"100%",display:"flex",flexDirection:"column",position:"relative",zIndex:1}}>

          {/* STATUS BAR */}
          <div className="sbar" style={{padding:"7px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              {/* Aegis logo in status bar */}
              <svg width="18" height="18" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polygon points="50,4 93,27.5 93,72.5 50,96 7,72.5 7,27.5" stroke={accent} strokeWidth="3" fill="none" opacity="0.8"/>
                <circle cx="50" cy="50" r="14" stroke={accent} strokeWidth="2.5" fill="none"/>
                <circle cx="50" cy="50" r="6" fill={accent}/>
              </svg>
              <span className="stxt">{isEva?`AEGIS_v2.0 — ${activeCompanion.status}`:isSpark?`✨ AEGIS ONLINE!! — ${activeCompanion.status} ✨`:`Aegis Intelligence — ${activeCompanion.status}`}</span>
            </div>
            <div style={{display:"flex",gap:"16px"}}>
              {isMounted&&<span className="stxt" style={{opacity:.6}}>LVL {level} · {xp} XP · {streak}🔥</span>}
              {isMounted&&<span className="stxt" style={{opacity:.35}}>{currentTime}</span>}
            </div>
          </div>

          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",position:"relative",overflow:"hidden"}}>

            {/* BRIEFING CARD */}
            {showBriefing && (
              <div className="briefcard">
                <div style={{padding:"18px 22px",borderRadius:isEva?"12px":isSpark?"24px":"28px",background:isEva?"rgba(0,0,0,.93)":"rgba(255,255,255,.96)",border:`2px solid rgba(${accentRgb},.4)`,boxShadow:`0 8px 40px rgba(${accentRgb},.18)`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
                    <div style={{fontFamily:isEva?"Share Tech Mono,monospace":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif",fontSize:isEva?"10px":"14px",color:accent,fontWeight:700,letterSpacing:isEva?"0.2em":"0"}}>
                      {isEva?"◆ DAILY_BRIEFING":isSpark?"🌸 HEY HEY HEY!! ✨":"☀️ Welcome back!"}
                    </div>
                    <button onClick={()=>setShowBriefing(false)} className="btn" style={{padding:"4px 8px",fontSize:"10px"}}>✕</button>
                  </div>
                  <div style={{fontSize:"13px",lineHeight:1.6,opacity:.72,fontFamily:isEva?"Rajdhani,sans-serif":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif"}}>
                    {lastMsg}
                  </div>
                  <div style={{display:"flex",gap:"8px",marginTop:"12px"}}>
                    <span style={{fontSize:"11px",padding:"4px 10px",borderRadius:"20px",background:`rgba(${accentRgb},.1)`,color:accent,fontFamily:"monospace"}}>🔥 {streak}d streak</span>
                    <span style={{fontSize:"11px",padding:"4px 10px",borderRadius:"20px",background:`rgba(${accentRgb},.1)`,color:accent,fontFamily:"monospace"}}>⚡ {tasks.length} tasks</span>
                  </div>
                </div>
              </div>
            )}

            {/* HEADER */}
            <header style={{width:"100%",padding:"14px 22px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",zIndex:50,position:"relative"}}>
              <div style={{display:"flex",gap:"8px"}}>
                <button onClick={()=>{playSound("click",theme);setIsTaskOpen(true);}} className="btn">{isEva?"GOALS":isSpark?"🎯 Goals!":"🎯 Goals"}</button>
                <button onClick={()=>{playSound("click",theme);setIsHistoryOpen(true);}} className="btn">{isEva?"HISTORY":isSpark?"💬 History!":"💬 History"}</button>
                <button onClick={()=>{if(confirm("Clear chat?"))setMessages([{role:"assistant",content:activeCompanion.greeting(profile.full_name||"Agent")}]);}} className="btn red">{isEva?"WIPE":"Wipe"}</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"5px"}}>
                <div style={{display:"flex",gap:"10px",padding:"8px 16px",background:isEva?"rgba(0,0,0,.65)":"rgba(255,255,255,.62)",borderRadius:"40px",border:`1px solid rgba(${accentRgb},.2)`,backdropFilter:"blur(10px)"}}>
                  {COMPANIONS.map(c=>(
                    <button key={c.id} onClick={()=>switchCompanion(c)} className={`cbn ${activeCompanion.id===c.id?"on":""} ${c.color}`}
                      style={{boxShadow:activeCompanion.id===c.id?`0 0 14px rgba(${c.accentRgb},.7)`:undefined}}/>
                  ))}
                </div>
                <div style={{fontFamily:"Share Tech Mono,monospace",fontSize:"9px",color:`rgba(${accentRgb},.65)`,letterSpacing:".14em",textTransform:"uppercase"}}>{activeCompanion.name} · {activeCompanion.label}</div>
              </div>
              <button onClick={()=>{playSound("click",theme);setIsProfileOpen(true);}} className="btn">{isEva?"PROFILE":isSpark?"✨ Profile":"👤 Profile"}</button>
            </header>

            {/* CHAT BUBBLE */}
            <div style={{width:"100%",maxWidth:"520px",padding:"0 22px",zIndex:20,position:"relative"}}>
              <div className="card msg-anim" style={{padding:isEva?"18px 22px":"20px 26px"}}>
                {isEva&&(
                  <div style={{fontFamily:"Share Tech Mono,monospace",fontSize:"9px",color:`rgba(${accentRgb},.55)`,marginBottom:"10px",display:"flex",alignItems:"center",gap:"8px",textTransform:"uppercase",letterSpacing:".14em"}}>
                    <span>◆ EVA_OUTPUT</span>
                    {isLoading&&<span className="dots" style={{color:accent}}><span/><span/><span/></span>}
                  </div>
                )}
                <div className="txt-main">
                  {isLoading?(
                    <div style={{display:"flex",alignItems:"center",gap:"8px",justifyContent:isEva?"flex-start":"center",color:`rgba(${accentRgb},.7)`}}>
                      <span style={{fontSize:"12px",fontFamily:isEva?"Share Tech Mono,monospace":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif"}}>
                        {isSpark?"SPARKLING IDEAS... ✨":isEva?"PROCESSING QUERY...":"Thinking..."}
                      </span>
                      <span className="dots"><span/><span/><span/></span>
                    </div>
                  ):<ReactMarkdown>{lastMsg}</ReactMarkdown>}
                </div>
              </div>
            </div>

            {/* 3D CHARACTER */}
            <div style={{position:"relative",width:"330px",height:"330px",zIndex:10}} className={companionAnim?`ca-${companionAnim}`:""}>
              <div className="aura" style={{position:"absolute",inset:"-20%",borderRadius:"50%",pointerEvents:"none"}}/>
              <div style={{width:"100%",height:"100%"}}>
                <Companion3D activeColor={activeCompanion.color} isThinking={isLoading} companionId={activeCompanion.id} onPoke={handlePoke} lastPoke={lastPoke}/>
              </div>
            </div>

            {/* BOTTOM */}
            <div style={{width:"100%",padding:"0 22px 22px",display:"flex",flexDirection:"column",gap:"9px",zIndex:50}}>
              <div style={{display:"flex",justifyContent:"center",gap:"7px",flexWrap:"wrap"}}>
                {[{l:"LVL",v:level},{l:"XP",v:xp},{l:"STREAK",v:`${streak}🔥`},{l:"TASKS",v:`${tasks.filter(t=>t.completed).length}/${tasks.length}`}].map((s,i)=>(
                  <div key={i} className="chip"><span className="chip-l">{s.l}</span><span className="chip-v">{s.v}</span></div>
                ))}
              </div>
              <div style={{maxWidth:"500px",margin:"0 auto",width:"100%"}}>
                <div className="xpbg"><div className="xpfg" style={{width:`${xpPct}%`}}/></div>
              </div>
              <div className="bar" style={{maxWidth:"640px",width:"100%",margin:"0 auto",display:"flex",gap:"10px",alignItems:"center",padding:"8px 8px 8px 16px"}}>
                {isEva&&<span style={{fontFamily:"Share Tech Mono,monospace",fontSize:"10px",color:`rgba(${accentRgb},.45)`,flexShrink:0}}>▶</span>}
                <input value={inputText} onChange={e=>setInputText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSendMessage()}
                  className="input"
                  placeholder={isEva?"AWAITING COMMAND, AGENT...":isSpark?"tell me EVERYTHING!! 💖":"Ask me anything, friend..."}/>
                <button onClick={startListening} className={`mic ${isListening?"on":""}`}>🎤</button>
                <button onClick={()=>handleSendMessage()} className="sbtn">{isEva?"TRANSMIT":isSpark?"SEND!! 💌":"Send ✦"}</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
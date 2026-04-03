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
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    const now = ctx.currentTime;
    const fmap: Record<string,number> = { squish:880, eva:660, spark:1046 };
    if (type==="click")    { osc.type="sine";     osc.frequency.setValueAtTime(440,now);              g.gain.setValueAtTime(.04,now); }
    if (type==="send")     { osc.type="sine";     osc.frequency.setValueAtTime(fmap[theme]||880,now); g.gain.setValueAtTime(.06,now); }
    if (type==="poke")     { osc.type="triangle"; osc.frequency.setValueAtTime(300,now); osc.frequency.exponentialRampToValueAtTime(150,now+.15); g.gain.setValueAtTime(.08,now); }
    if (type==="switch")   { osc.type="sine";     osc.frequency.setValueAtTime(660,now); osc.frequency.setValueAtTime(880,now+.08); g.gain.setValueAtTime(.06,now); }
    if (type==="briefing") { osc.type="sine";     osc.frequency.setValueAtTime(523,now); osc.frequency.setValueAtTime(659,now+.12); g.gain.setValueAtTime(.08,now); }
    if (type==="levelup")  { osc.type="sine"; [523,659,784,1046].forEach((f,i)=>osc.frequency.setValueAtTime(f,now+i*.1)); g.gain.setValueAtTime(.12,now); }
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
  const [session, setSession]             = useState<any>(null);
  const [authLoading, setAuthLoading]     = useState(true);
  const [profile, setProfile]             = useState<Profile>({ full_name:"", persona:"General", objective:"" });
  const [editingName, setEditingName]     = useState(false);
  const [nameInput, setNameInput]         = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [messages, setMessages]           = useState<any[]>([]);
  const [tasks, setTasks]                 = useState<Task[]>([]);
  const [newTaskText, setNewTaskText]     = useState("");
  const [isLoading, setIsLoading]         = useState(false);
  const [inputText, setInputText]         = useState("");
  // ── Start with COMPANIONS[0] then fix from localStorage synchronously ──────
  const [activeCompanion, setActiveCompanion] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aegis_companion");
      return COMPANIONS.find(c => c.id === saved) || COMPANIONS[0];
    }
    return COMPANIONS[0];
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isTaskOpen, setIsTaskOpen]       = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isListening, setIsListening]     = useState(false);
  const [pokeCount, setPokeCount]         = useState(0);
  const [lastPoke, setLastPoke]           = useState(0);
  const [isMounted, setIsMounted]         = useState(false);
  const [currentTime, setCurrentTime]     = useState("");
  const [currentMood, setCurrentMood]     = useState<Mood>("neutral");
  const [moodMessage, setMoodMessage]     = useState("");
  const [showMoodBanner, setShowMoodBanner] = useState(false);
  const [xp, setXP]                       = useState(0);
  const [streak, setStreak]               = useState(1);
  const [showLevelUp, setShowLevelUp]     = useState(false);
  const [levelUpNum, setLevelUpNum]       = useState(1);
  const [showBriefing, setShowBriefing]   = useState(false);
  const [companionAnim, setCompanionAnim] = useState<""|"bounce"|"spin"|"wave">("");
  const [quotaRemaining, setQuotaRemaining] = useState<number|null>(null);
  const [showQuotaWarn, setShowQuotaWarn] = useState(false);
  const [activeKeyLabel, setActiveKeyLabel] = useState("");

  const prevLevelRef  = useRef(1);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const greetingSetRef = useRef(false);

  const { accent, accentRgb, theme } = activeCompanion;
  const level       = getLevelFromXP(xp);
  const nextLevelXP = getXPForLevel(level+1);
  const currLevelXP = getXPForLevel(level);
  const xpPct       = Math.min(100, ((xp-currLevelXP)/(nextLevelXP-currLevelXP))*100);
  const isEva=theme==="eva", isSpark=theme==="spark", isSquish=theme==="squish";

  // ── MOUNT + CLOCK ──────────────────────────────────────────────────────────
  useEffect(() => {
    setIsMounted(true);
    const tick = () => setCurrentTime(new Date().toLocaleTimeString("en-US",{hour12:false}));
    tick(); const iv = setInterval(tick,1000); return ()=>clearInterval(iv);
  },[]);

  // ── XP / STREAK from localStorage ─────────────────────────────────────────
  useEffect(() => {
    const savedXP     = parseInt(localStorage.getItem("aegis_xp")||"0");
    const savedStreak = parseInt(localStorage.getItem("aegis_streak")||"1");
    const lastDate    = localStorage.getItem("aegis_last_date");
    const today       = new Date().toDateString();
    const yesterday   = new Date(Date.now()-86400000).toDateString();
    setXP(savedXP); prevLevelRef.current = getLevelFromXP(savedXP);
    if (lastDate!==today) {
      const ns = lastDate===yesterday ? savedStreak+1 : lastDate ? 1 : savedStreak;
      setStreak(ns);
      localStorage.setItem("aegis_streak",String(ns));
      localStorage.setItem("aegis_last_date",today);
    } else { setStreak(savedStreak); }
  },[]);

  // ── XP LEVEL UP watcher ────────────────────────────────────────────────────
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

  // ── DATA FETCH — fresh greeting, correct companion ─────────────────────────
  useEffect(() => {
    if (!session || greetingSetRef.current) return;
    greetingSetRef.current = true;

    (async () => {
      const {data:pData} = await supabase.from("profiles").select("*").eq("id",session.user.id).single();
      if (pData) { setProfile(pData); setNameInput(pData.full_name||""); }

      const {data:tData} = await supabase.from("tasks").select("*").order("created_at",{ascending:true});
      if (tData) setTasks(tData);

      // ── Get the correct companion AFTER everything is ready ──────────────
      const savedCompId = localStorage.getItem("aegis_companion");
      const companion   = COMPANIONS.find(c=>c.id===savedCompId) || COMPANIONS[0];
      // Sync state in case initial state was wrong
      setActiveCompanion(companion);

      const name     = pData?.full_name || "Agent";
      const hour     = new Date().getHours();
      const tod      = hour<12?"morning":hour<18?"afternoon":"evening";
      const savedStr = parseInt(localStorage.getItem("aegis_streak")||"1");
      const pending  = (tData||[]).filter((t:Task)=>!t.completed).length;

      const briefLine  = `Good ${tod}, ${name}! 🌅 You have ${(tData||[]).length} tasks (${pending} pending) · Streak: ${savedStr} days 🔥`;
      const greetLine  = companion.greeting(name);
      const fullMsg    = `${briefLine}\n\n${greetLine}`;

      setMessages([{ role:"assistant", content: fullMsg }]);
      setShowBriefing(true);
      playSound("briefing","squish");
      setTimeout(()=>setShowBriefing(false), 7000);
    })();
  },[session]);

  // ── COMPANION SWITCH ───────────────────────────────────────────────────────
  const switchCompanion = (c: typeof COMPANIONS[0]) => {
    if (c.id===activeCompanion.id) return;
    playSound("switch",c.theme); setIsTransitioning(true);
    setTimeout(()=>{
      setActiveCompanion(c);
      localStorage.setItem("aegis_companion",c.id);
      setIsTransitioning(false);
    },380);
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
    } catch(err) {
      alert("Upload failed. Create 'avatars' bucket in Supabase Storage with public access.");
    }
    setAvatarUploading(false);
  };

  // ── TASKS ──────────────────────────────────────────────────────────────────
  const handleAddTask = async () => {
    if(!newTaskText.trim()||!session) return;
    const {data,error}=await supabase.from("tasks").insert({
      text:newTaskText.trim(), category:"general", completed:false, user_id:session.user.id,
    }).select().single();
    if(!error&&data){setTasks(p=>[...p,data]);setNewTaskText("");addXP(25);}
  };

  const handleToggleTask = async (task:Task) => {
    await supabase.from("tasks").update({completed:!task.completed}).eq("id",task.id);
    setTasks(p=>p.map(t=>t.id===task.id?{...t,completed:!t.completed}:t));
  };

  // ── POKE ───────────────────────────────────────────────────────────────────
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

  const triggerAnim=(a:"bounce"|"spin"|"wave")=>{setCompanionAnim(a);setTimeout(()=>setCompanionAnim(""),700);};

  // ── VOICE ──────────────────────────────────────────────────────────────────
  const startListening = () => {
    playSound("click",theme);
    const SR=(window as any).webkitSpeechRecognition||(window as any).SpeechRecognition;
    if(!SR)return;
    const rec=new SR();
    rec.onstart=()=>setIsListening(true);
    rec.onresult=(e:any)=>{
      const t=e.results[0][0].transcript;
      handleSendMessage(t.toLowerCase().includes("wake up")?`Protocols initiated. ${activeCompanion.name} is online.`:t);
    };
    rec.onend=()=>setIsListening(false);
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
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:text,companionId:activeCompanion.id,chatHistory:messages.slice(-5),userProfile:profile,currentMood:mood}),
      });
      if(!res.ok) throw new Error(`API error: ${res.status}`);
      const data=await res.json();
      setMessages(p=>[...p,{role:"user",content:text},{role:"assistant",content:data.reply}]);
      addXP(10); triggerAnim("wave");
      if(!isSilent) speakText(data.reply,activeCompanion);
    } catch(e) {
      console.error("Chat error:",e);
      setMessages(p=>[...p,{role:"user",content:text},{role:"assistant",content:"Sorry, I couldn't connect. Please check your internet and try again."}]);
    }
    finally{setIsLoading(false);}
  };

  // ── TTS ────────────────────────────────────────────────────────────────────
  const speakText = async (text:string, c:typeof COMPANIONS[0]) => {
    const clean=text.replace(/\[.*?\]/g,"").replace(/[*_#`~]/g,"").trim().slice(0,500);
    try {
      const res=await fetch("/api/tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:clean,voiceId:c.voiceId})});
      const rem=res.headers.get("X-EL-Remaining");
      const keyLbl=res.headers.get("X-EL-Key")||"";
      if(rem){const r=parseInt(rem);setQuotaRemaining(r);setActiveKeyLabel(keyLbl);if(r<QUOTA_WARN&&r>0){setShowQuotaWarn(true);setTimeout(()=>setShowQuotaWarn(false),6000);}}
      if(!res.ok){browserTTS(clean,c.id);return;}
      const ct=res.headers.get("content-type")||"";
      if(ct.includes("audio")){
        const blob=await res.blob();const url=URL.createObjectURL(blob);const audio=new Audio(url);
        if(c.id==="eva")audio.playbackRate=0.85;
        if(c.id==="spark")audio.playbackRate=1.15;
        audio.onended=()=>URL.revokeObjectURL(url);await audio.play();
      } else browserTTS(clean,c.id);
    } catch{browserTTS(clean,c.id);}
  };

  const browserTTS=(text:string,id:string)=>{
    if(!window.speechSynthesis)return;
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    const voices=window.speechSynthesis.getVoices();
    if(id==="eva")  {u.rate=0.82;u.pitch=0.65;const v=voices.find(v=>/daniel|george|male|uk/i.test(v.name));if(v)u.voice=v;}
    if(id==="spark"){u.rate=1.2; u.pitch=1.75;const v=voices.find(v=>/samantha|zira|female/i.test(v.name));if(v)u.voice=v;}
    else            {u.rate=1.0; u.pitch=1.2;}
    window.speechSynthesis.speak(u);
  };

  // ── AUTH GUARDS ────────────────────────────────────────────────────────────
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

  const lastMsg = messages.slice().reverse().find(m=>m.role==="assistant")?.content || "Ready for input.";
  const userEmail = session?.user?.email||"";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Bubblegum+Sans&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');

        /* ── ANIMATIONS ── */
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
        @keyframes cab{0%,100%{transform:translateY(0)}35%{transform:translateY(-18px)}65%{transform:translateY(-6px)}}
        @keyframes caw{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
        @keyframes fl1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-15px,20px) scale(1.04)}}
        @keyframes fl2{0%,100%{transform:translate(0,0)}50%{transform:translate(12px,-15px)}}
        @keyframes sdrift{from{background-position:0 0}to{background-position:30px 30px}}
        @keyframes rr{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(360deg)}}
        @keyframes sw{0%{top:15%;opacity:0}10%{opacity:1}90%{opacity:1}100%{top:85%;opacity:0}}
        @keyframes stfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}

        .ca-bounce{animation:cab .6s cubic-bezier(.36,.07,.19,.97)}
        .ca-wave{animation:caw .6s ease-in-out}
        .msg-anim{animation:msa .35s ease}
        .dots{display:inline-flex;gap:3px;align-items:center}
        .dots span{width:5px;height:5px;border-radius:50%;background:currentColor;animation:bd 1.2s infinite}
        .dots span:nth-child(2){animation-delay:.2s}.dots span:nth-child(3){animation-delay:.4s}
        .cbn{width:32px;height:32px;border-radius:50%;border:2px solid transparent;transition:all .3s;cursor:pointer;flex-shrink:0}
        .cbn.on{border-color:white;transform:scale(1.2)}
        .cbn:not(.on){opacity:.3}
        .cbn:not(.on):hover{opacity:.65;transform:scale(1.05)}
        .lup{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;pointer-events:none;animation:lu 3.5s ease forwards}
        .mb{position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:500;pointer-events:none;animation:mbi .4s ease,mbo .4s ease 3.8s forwards;white-space:nowrap;max-width:90vw}
        .briefcard{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:300;width:min(380px,88vw);animation:bc .5s cubic-bezier(.34,1.56,.64,1)}
        .flash{position:fixed;inset:0;z-index:9998;pointer-events:none;animation:fl .4s ease}
        .aura{position:absolute;inset:-15%;border-radius:50%;pointer-events:none;animation:ap 3s ease-in-out infinite}
        .panel{position:fixed;top:0;height:100%;height:100dvh;width:min(320px,88vw);z-index:110;transition:transform .4s cubic-bezier(.23,1,.32,1);border-style:solid;border-width:0}
        .panel.left{left:0;border-right-width:1px}
        .panel.right{right:0;border-left-width:1px}
        .hs{scrollbar-width:none;-webkit-overflow-scrolling:touch}.hs::-webkit-scrollbar{display:none}
        .mic.on{border-color:#EF4444!important;background:rgba(239,68,68,.14)!important;color:#EF4444!important;animation:pg 1s infinite}
        .avatar-wrap{position:relative;cursor:pointer}
        .avatar-overlay{position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;font-size:18px}
        .avatar-wrap:hover .avatar-overlay{opacity:1}
        .quota-toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:9000;pointer-events:none;animation:mbi .4s ease,mbo .4s ease 5.6s forwards;white-space:nowrap;max-width:90vw}
        .quota-inner{padding:10px 20px;border-radius:12px;background:rgba(239,68,68,.12);border:1.5px solid rgba(239,68,68,.5);font-family:'Share Tech Mono',monospace;font-size:10px;color:#FCA5A5;letter-spacing:.06em;display:flex;align-items:center;gap:8px}
        .task-input{background:transparent;border:none;border-bottom:1.5px solid;outline:none;flex:1;padding:4px 6px;font-size:13px;min-width:0}
        .name-edit{background:transparent;border:none;border-bottom:2px solid;outline:none;font-weight:700;font-size:17px;text-align:center;width:100%;padding:2px 4px}

        /* ── SQUISH ── */
        .t-squish{background:linear-gradient(145deg,#FFFBEB 0%,#FEF3C7 60%,#FDE68A 100%);font-family:'Fredoka',sans-serif}
        .t-squish .btn{background:rgba(255,255,255,.75);border:2px solid rgba(245,158,11,.3);color:#92400E;border-radius:50px;padding:6px 14px;font-family:'Fredoka',sans-serif;font-weight:600;font-size:12px;cursor:pointer;transition:all .2s;white-space:nowrap}
        .t-squish .btn:hover,.t-squish .btn:active{background:white;border-color:#F59E0B;transform:scale(1.05)}
        .t-squish .btn.red{color:#DC2626;border-color:rgba(220,38,38,.3)}
        .t-squish .card{background:rgba(255,255,255,.9);border-radius:24px;border:2px solid rgba(245,158,11,.25);box-shadow:0 6px 30px rgba(245,158,11,.12);backdrop-filter:blur(16px)}
        .t-squish .ibar{background:rgba(255,255,255,.92);border-radius:50px;border:2px solid rgba(245,158,11,.35);box-shadow:0 4px 20px rgba(245,158,11,.12)}
        .t-squish .txt-main{font-family:'Fredoka',sans-serif;font-size:15px;font-weight:500;color:#374151;text-align:center;line-height:1.6}
        .t-squish .inp{font-family:'Fredoka',sans-serif;font-size:14px;color:#78350F;background:transparent;border:none;outline:none;width:100%;min-width:0}
        .t-squish .inp::placeholder{color:rgba(120,53,15,.35)}
        .t-squish .sbtn{background:#F59E0B;color:white;border:none;border-radius:40px;padding:9px 18px;font-family:'Fredoka',sans-serif;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 4px 12px rgba(245,158,11,.35);transition:all .2s;white-space:nowrap;flex-shrink:0}
        .t-squish .sbtn:active{background:#D97706;transform:scale(0.97)}
        .t-squish .mic{background:rgba(245,158,11,.1);border:2px solid rgba(245,158,11,.3);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;flex-shrink:0;transition:all .2s}
        .t-squish .chip{background:rgba(255,255,255,.8);border-radius:20px;border:1.5px solid rgba(245,158,11,.25);padding:4px 10px;display:flex;align-items:center;gap:4px}
        .t-squish .chip-l{font-family:'Fredoka',sans-serif;font-size:10px;color:rgba(120,53,15,.45)}
        .t-squish .chip-v{font-family:'Fredoka',sans-serif;font-size:13px;font-weight:600;color:#92400E}
        .t-squish .xpbg{background:rgba(245,158,11,.15);border-radius:10px;height:4px}
        .t-squish .xpfg{background:linear-gradient(90deg,#F59E0B,#FCD34D);border-radius:10px;height:100%;transition:width .8s cubic-bezier(.34,1.56,.64,1)}
        .t-squish .sbar{background:rgba(255,251,235,.9);border-bottom:1.5px solid rgba(245,158,11,.2)}
        .t-squish .stxt{font-family:'Fredoka',sans-serif;font-size:12px;color:rgba(120,53,15,.55)}
        .t-squish .dot{background:#F59E0B;box-shadow:0 0 8px rgba(245,158,11,.9)}
        .t-squish .panel{background:rgba(255,251,235,.97);border-color:rgba(245,158,11,.2)}
        .t-squish .ptitle{font-family:'Fredoka',sans-serif;font-size:20px;font-weight:700;color:#92400E}
        .t-squish .muser{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);border-radius:14px}
        .t-squish .mbot{background:white;border:1px solid rgba(245,158,11,.12);border-radius:14px}
        .t-squish .aura{background:radial-gradient(ellipse,rgba(245,158,11,.14) 0%,transparent 70%)}
        .t-squish .task-input{color:#78350F;border-bottom-color:rgba(245,158,11,.4);font-family:'Fredoka',sans-serif}
        .t-squish .name-edit{color:#92400E;border-bottom-color:#F59E0B;font-family:'Fredoka',sans-serif}
        .sq-b1{position:fixed;width:250px;height:250px;border-radius:50%;background:radial-gradient(circle,rgba(251,191,36,.1) 0%,transparent 70%);top:-40px;right:-40px;pointer-events:none;animation:fl1 7s ease-in-out infinite}
        .sq-b2{position:fixed;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(245,158,11,.07) 0%,transparent 70%);bottom:100px;left:-20px;pointer-events:none;animation:fl2 9s ease-in-out infinite}

        /* ── SPARK ── */
        .t-spark{background:linear-gradient(135deg,#FFF0F6 0%,#FCE4EC 50%,#F8BBD0 100%);font-family:'Bubblegum Sans',cursive}
        .t-spark .btn{background:rgba(255,255,255,.78);border:2px solid rgba(236,72,153,.35);color:#9D174D;border-radius:16px;padding:6px 14px;font-family:'Bubblegum Sans',cursive;font-size:12px;cursor:pointer;transition:all .15s;white-space:nowrap}
        .t-spark .btn:active{background:white;border-color:#EC4899;transform:scale(1.05)}
        .t-spark .btn.red{color:#DC2626;border-color:rgba(220,38,38,.3)}
        .t-spark .card{background:rgba(255,255,255,.9);border-radius:24px;border:2.5px solid rgba(236,72,153,.3);box-shadow:3px 3px 0 rgba(236,72,153,.18),0 6px 24px rgba(236,72,153,.1);backdrop-filter:blur(16px)}
        .t-spark .ibar{background:rgba(255,255,255,.92);border-radius:20px;border:2px solid rgba(236,72,153,.45);box-shadow:3px 3px 0 rgba(236,72,153,.18)}
        .t-spark .txt-main{font-family:'Bubblegum Sans',cursive;font-size:16px;color:#374151;text-align:center;line-height:1.6}
        .t-spark .inp{font-family:'Bubblegum Sans',cursive;font-size:14px;color:#831843;background:transparent;border:none;outline:none;width:100%;min-width:0}
        .t-spark .inp::placeholder{color:rgba(131,24,67,.32)}
        .t-spark .sbtn{background:linear-gradient(135deg,#EC4899,#F472B6);color:white;border:none;border-radius:16px;padding:9px 18px;font-family:'Bubblegum Sans',cursive;font-size:13px;cursor:pointer;box-shadow:2px 2px 0 rgba(236,72,153,.3);transition:all .15s;white-space:nowrap;flex-shrink:0}
        .t-spark .sbtn:active{transform:translate(1px,1px)}
        .t-spark .mic{background:rgba(236,72,153,.1);border:2px solid rgba(236,72,153,.35);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;flex-shrink:0;transition:all .15s}
        .t-spark .chip{background:rgba(255,255,255,.82);border-radius:14px;border:1.5px solid rgba(236,72,153,.22);padding:4px 10px;display:flex;align-items:center;gap:4px;box-shadow:1px 1px 0 rgba(236,72,153,.12)}
        .t-spark .chip-l{font-family:'Bubblegum Sans',cursive;font-size:10px;color:rgba(157,23,77,.5)}
        .t-spark .chip-v{font-family:'Bubblegum Sans',cursive;font-size:13px;color:#9D174D}
        .t-spark .xpbg{background:rgba(236,72,153,.12);border-radius:10px;height:4px}
        .t-spark .xpfg{background:linear-gradient(90deg,#EC4899,#F472B6,#FB7185);border-radius:10px;height:100%;transition:width .8s cubic-bezier(.34,1.56,.64,1)}
        .t-spark .sbar{background:rgba(255,240,246,.9);border-bottom:1.5px solid rgba(236,72,153,.2)}
        .t-spark .stxt{font-family:'Bubblegum Sans',cursive;font-size:12px;color:rgba(157,23,77,.6)}
        .t-spark .dot{background:#EC4899;box-shadow:0 0 8px rgba(236,72,153,1)}
        .t-spark .panel{background:rgba(255,240,246,.97);border-color:rgba(236,72,153,.2)}
        .t-spark .ptitle{font-family:'Bubblegum Sans',cursive;font-size:20px;color:#9D174D}
        .t-spark .muser{background:rgba(236,72,153,.08);border:1px solid rgba(236,72,153,.2);border-radius:14px}
        .t-spark .mbot{background:white;border:1px solid rgba(236,72,153,.15);border-radius:14px}
        .t-spark .aura{background:radial-gradient(ellipse,rgba(236,72,153,.12) 0%,transparent 70%)}
        .t-spark .task-input{color:#831843;border-bottom-color:rgba(236,72,153,.4);font-family:'Bubblegum Sans',cursive}
        .t-spark .name-edit{color:#9D174D;border-bottom-color:#EC4899;font-family:'Bubblegum Sans',cursive}
        .sp-star{position:fixed;pointer-events:none;animation:stfloat 4s ease-in-out infinite;z-index:0}

        /* ── EVA ── */
        .t-eva{background:#050508;font-family:'Rajdhani',sans-serif}
        .t-eva::before{content:'';position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(100,116,139,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(100,116,139,.03) 1px,transparent 1px);background-size:40px 40px;z-index:0}
        .t-eva .btn{background:rgba(255,255,255,.04);border:1px solid rgba(100,116,139,.28);color:rgba(255,255,255,.45);border-radius:3px;padding:6px 12px;font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.15em;cursor:pointer;transition:all .2s;text-transform:uppercase;white-space:nowrap}
        .t-eva .btn:hover,.t-eva .btn:active{border-color:rgba(100,116,139,.6);color:#94A3B8;background:rgba(100,116,139,.06)}
        .t-eva .btn.red{color:rgba(239,68,68,.55);border-color:rgba(239,68,68,.2)}
        .t-eva .btn.red:active{color:#EF4444;border-color:rgba(239,68,68,.5)}
        .t-eva .card{background:rgba(0,0,0,.78);border-radius:12px;border:1px solid rgba(100,116,139,.22);box-shadow:0 0 30px rgba(100,116,139,.07);backdrop-filter:blur(20px)}
        .t-eva .ibar{background:rgba(0,0,0,.85);border-radius:8px;border:1px solid rgba(100,116,139,.28)}
        .t-eva .txt-main{font-family:'Rajdhani',sans-serif;font-size:14px;color:rgba(255,255,255,.82);text-align:left;line-height:1.65;letter-spacing:.02em}
        .t-eva .inp{font-family:'Rajdhani',sans-serif;font-size:14px;color:white;background:transparent;border:none;outline:none;width:100%;min-width:0;letter-spacing:.04em}
        .t-eva .inp::placeholder{color:rgba(255,255,255,.18)}
        .t-eva .sbtn{background:#475569;color:white;border:none;border-radius:4px;padding:9px 18px;font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.15em;cursor:pointer;transition:all .2s;text-transform:uppercase;white-space:nowrap;flex-shrink:0;clip-path:polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)}
        .t-eva .sbtn:active{background:#64748B}
        .t-eva .mic{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:15px;color:rgba(255,255,255,.35);cursor:pointer;flex-shrink:0;transition:all .2s}
        .t-eva .chip{background:rgba(100,116,139,.06);border-radius:3px;border:1px solid rgba(100,116,139,.18);padding:4px 8px;display:flex;align-items:center;gap:4px}
        .t-eva .chip-l{font-family:'Share Tech Mono',monospace;font-size:7px;color:rgba(255,255,255,.22);letter-spacing:.12em}
        .t-eva .chip-v{font-family:'Share Tech Mono',monospace;font-size:10px;color:#94A3B8}
        .t-eva .xpbg{background:rgba(100,116,139,.1);border-radius:2px;height:3px}
        .t-eva .xpfg{background:linear-gradient(90deg,#475569,#94A3B8);border-radius:2px;height:100%;transition:width .8s cubic-bezier(.34,1.56,.64,1)}
        .t-eva .sbar{background:rgba(100,116,139,.05);border-bottom:1px solid rgba(100,116,139,.18)}
        .t-eva .stxt{font-family:'Share Tech Mono',monospace;font-size:8px;color:rgba(100,116,139,.7);letter-spacing:.15em;text-transform:uppercase}
        .t-eva .dot{background:#64748B;box-shadow:0 0 8px rgba(100,116,139,.9)}
        .t-eva .panel{background:rgba(0,0,0,.95);border-color:rgba(100,116,139,.18)}
        .t-eva .ptitle{font-family:'Share Tech Mono',monospace;font-size:11px;color:#64748B;letter-spacing:.2em;text-transform:uppercase}
        .t-eva .muser{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:6px}
        .t-eva .mbot{background:rgba(100,116,139,.05);border:1px solid rgba(100,116,139,.12);border-radius:6px}
        .t-eva .aura{background:radial-gradient(ellipse,rgba(100,116,139,.09) 0%,transparent 70%)}
        .t-eva .task-input{color:white;border-bottom-color:rgba(100,116,139,.4);font-family:'Share Tech Mono',monospace;font-size:11px}
        .t-eva .name-edit{color:white;border-bottom-color:#64748B;font-family:'Share Tech Mono',monospace;font-size:13px}
        .eva-r{position:fixed;border-radius:50%;border:1px solid rgba(100,116,139,.08);pointer-events:none;top:50%;left:50%}
        .eva-r1{width:600px;height:600px;transform:translate(-50%,-50%);animation:rr 24s linear infinite}
        .eva-r2{width:440px;height:440px;transform:translate(-50%,-50%);animation:rr 17s linear infinite reverse;border-style:dashed}
        .eva-sw{position:fixed;left:0;right:0;height:1px;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(100,116,139,.3),transparent);animation:sw 5s ease-in-out infinite}

        /* ── MOBILE RESPONSIVE ── */
        /* App container uses dvh for correct mobile height */
        .app-root {
          height: 100vh;
          height: 100dvh;
          width: 100%;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        /* Status bar */
        .status-bar {
          flex-shrink: 0;
          padding: 6px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        /* Main content grows to fill space between status bar and input */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow: hidden;
          min-height: 0;
        }

        /* Header row */
        .header-row {
          width: 100%;
          padding: 10px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 50;
          flex-shrink: 0;
          gap: 6px;
        }

        /* Chat bubble - scrollable if text is long */
        .chat-bubble-wrap {
          width: 100%;
          max-width: 500px;
          padding: 0 14px;
          z-index: 20;
          flex-shrink: 0;
        }

        /* Companion area - takes remaining space */
        .companion-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
          position: relative;
          width: 100%;
        }

        /* Inner companion 3D container - responsive size */
        .companion-3d {
          position: relative;
          width: min(280px, 55vw);
          height: min(280px, 55vw);
        }

        /* Bottom section - fixed at bottom, never cut off */
        .bottom-section {
          flex-shrink: 0;
          width: 100%;
          padding: 8px 14px 12px;
          display: flex;
          flex-direction: column;
          gap: 7px;
          /* Safe area for phones with home bar */
          padding-bottom: max(12px, env(safe-area-inset-bottom));
        }

        /* Stats chips row */
        .stats-row {
          display: flex;
          justify-content: center;
          gap: 6px;
          flex-wrap: nowrap;
          overflow-x: auto;
        }
        .stats-row::-webkit-scrollbar { display: none; }

        /* Input bar */
        .input-bar {
          width: 100%;
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 7px 7px 7px 14px;
        }

        /* Companion selector - scrollable on very small screens */
        .comp-selector {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .comp-btns {
          display: flex;
          gap: 8px;
          padding: 7px 14px;
          border-radius: 40px;
          backdrop-filter: blur(10px);
        }

        /* Desktop enhancements */
        @media (min-width: 768px) {
          .header-row { padding: 14px 22px; gap: 12px; }
          .chat-bubble-wrap { padding: 0 22px; }
          .bottom-section { padding: 0 22px 22px; padding-bottom: max(22px, env(safe-area-inset-bottom)); }
          .companion-3d { width: 320px; height: 320px; }
          .status-bar { padding: 7px 24px; }
          .input-bar { padding: 8px 8px 8px 16px; }
          .comp-btns { gap: 10px; padding: 8px 16px; }
          .cbn { width: 36px; height: 36px; }
        }
      `}</style>

      {/* ── ROOT ── */}
      <div className={`t-${theme} app-root`}>

        {/* DECO */}
        {isEva   && <><div className="eva-r eva-r1"/><div className="eva-r eva-r2"/><div className="eva-sw"/></>}
        {isSquish && <><div className="sq-b1"/><div className="sq-b2"/></>}
        {isSpark  && ["✦","★","💖","✨","🌸"].map((s,i)=>(
          <div key={i} className="sp-star" style={{left:i<3?`${8+i*22}%`:undefined,right:i>=3?`${5+(i-3)*22}%`:undefined,top:`${4+(i%3)*7}%`,fontSize:"16px",animationDelay:`${i*.65}s`,opacity:.25,color:i%2===0?"#EC4899":"#F472B6"}}>{s}</div>
        ))}

        {isTransitioning && <div className="flash" style={{background:`rgba(${accentRgb},.12)`}}/>}
        <AppDownloadBanner/>

        {/* LEVEL UP */}
        {showLevelUp && (
          <div className="lup">
            <div style={{padding:"16px 32px",borderRadius:isEva?"8px":"20px",background:isEva?"rgba(0,0,0,.92)":"rgba(255,255,255,.96)",border:`2px solid ${accent}`,boxShadow:`0 0 40px rgba(${accentRgb},.5)`,textAlign:"center"}}>
              <div style={{fontSize:"28px",marginBottom:"6px"}}>🏆</div>
              <div style={{fontFamily:isEva?"Share Tech Mono,monospace":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif",fontSize:isEva?"12px":"17px",color:accent,fontWeight:700}}>
                {isSpark?`LEVEL ${levelUpNum} UNLOCKED!! 🎉`:isEva?`LEVEL_${levelUpNum}_REACHED`:`Level ${levelUpNum} reached! ✨`}
              </div>
            </div>
          </div>
        )}

        {/* MOOD BANNER */}
        {showMoodBanner && (
          <div className="mb">
            <div style={{padding:"9px 18px",borderRadius:isEva?"4px":"18px",background:isEva?"rgba(0,0,0,.88)":"rgba(255,255,255,.93)",border:`1.5px solid rgba(${accentRgb},.5)`,fontSize:isEva?"9px":"12px",fontFamily:isEva?"Share Tech Mono,monospace":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif",color:isEva?accent:"#374151",display:"flex",alignItems:"center",gap:"8px"}}>
              <span>{currentMood==="stressed"?"💛":currentMood==="happy"?"🎉":"🎯"}</span>
              {moodMessage}
            </div>
          </div>
        )}

        {/* QUOTA TOAST */}
        {showQuotaWarn && quotaRemaining!==null && (
          <div className="quota-toast">
            <div className="quota-inner"><span>⚠️</span>Voice quota low — {quotaRemaining.toLocaleString()} chars left.</div>
          </div>
        )}

        {/* ══ HISTORY PANEL ══ */}
        <div className={`panel left ${isHistoryOpen?"translate-x-0":"-translate-x-full"}`} style={{borderColor:`rgba(${accentRgb},.2)`}}>
          <div style={{padding:"20px 18px",height:"100%",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"16px",alignItems:"center"}}>
              <div className="ptitle">{isEva?"SYNC_LOGS":isSpark?"💬 History!!":"Chat History"}</div>
              <button onClick={()=>setIsHistoryOpen(false)} className="btn">✕</button>
            </div>
            <div className="hs" style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:"8px"}}>
              {messages.map((m,i)=>(
                <div key={i} className={m.role==="user"?"muser":"mbot"} style={{padding:"9px 12px"}}>
                  <div style={{fontFamily:"monospace",fontSize:"8px",opacity:.35,marginBottom:"3px",textTransform:"uppercase"}}>{m.role==="user"?"▶ You":`◆ ${activeCompanion.name}`}</div>
                  <div style={{fontSize:"12px",lineHeight:1.4,opacity:.75}}>{m.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ GOALS PANEL ══ */}
        <div className={`panel left ${isTaskOpen?"translate-x-0":"-translate-x-full"}`} style={{borderColor:`rgba(${accentRgb},.2)`,zIndex:120}}>
          <div style={{padding:"20px 18px",height:"100%",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"16px",alignItems:"center"}}>
              <div className="ptitle">{isEva?"OBJECTIVES":isSpark?"🎯 Goals!!":"My Goals 🎯"}</div>
              <button onClick={()=>setIsTaskOpen(false)} className="btn">✕</button>
            </div>
            <div className="hs" style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:"8px"}}>
              {tasks.length===0
                ?<div style={{textAlign:"center",padding:"40px 0",opacity:.25,fontFamily:"monospace",fontSize:"12px"}}>No objectives yet</div>
                :tasks.map(t=>(
                  <div key={t.id} className="mbot" style={{padding:"10px 12px",cursor:"pointer"}} onClick={()=>handleToggleTask(t)}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <div style={{width:"15px",height:"15px",borderRadius:"50%",border:`2px solid rgba(${accentRgb},.5)`,background:t.completed?accent:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",color:"black"}}>{t.completed?"✓":""}</div>
                      <div style={{fontSize:"13px",fontWeight:600,opacity:.8,textDecoration:t.completed?"line-through":"none"}}>{t.text}</div>
                    </div>
                  </div>
                ))}
            </div>
            <div style={{marginTop:"10px",display:"flex",gap:"8px",alignItems:"center",borderTop:`1px solid rgba(${accentRgb},.15)`,paddingTop:"10px"}}>
              <input className="task-input" placeholder={isEva?"Enter objective...":isSpark?"New goal!! ✨":"Add a goal..."}
                value={newTaskText} onChange={e=>setNewTaskText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAddTask()}
                style={{color:isEva?"white":isSpark?"#831843":"#78350F",borderBottomColor:isEva?"rgba(100,116,139,.4)":isSpark?"rgba(236,72,153,.4)":"rgba(245,158,11,.4)",fontFamily:isEva?"Share Tech Mono,monospace":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif"}}/>
              <button className="sbtn" style={{padding:"7px 12px",borderRadius:isEva?"4px":"14px",fontSize:"12px"}} onClick={handleAddTask}>+</button>
            </div>
          </div>
        </div>

        {/* ══ PROFILE PANEL ══ */}
        <div className={`panel right ${isProfileOpen?"translate-x-0":"translate-x-full"}`} style={{borderColor:`rgba(${accentRgb},.2)`}}>
          <div className="hs" style={{padding:"20px 18px",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",width:"100%",marginBottom:"18px"}}>
              <div className="ptitle">{isEva?"AGENT_STATS":isSpark?"✨ Stats!!":"My Stats 👤"}</div>
              <button onClick={()=>setIsProfileOpen(false)} className="btn">✕</button>
            </div>
            {/* Avatar */}
            <div className="avatar-wrap" style={{marginBottom:"8px"}} onClick={()=>fileInputRef.current?.click()}>
              <div style={{width:"72px",height:"72px",borderRadius:"50%",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",background:`rgba(${accentRgb},.1)`,border:`2px solid rgba(${accentRgb},.5)`,boxShadow:`0 0 16px rgba(${accentRgb},.22)`}}>
                {avatarUploading
                  ?<div style={{width:"22px",height:"22px",border:`2px solid rgba(${accentRgb},.3)`,borderTop:`2px solid ${accent}`,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
                  :profile.avatar_url
                  ?<img src={profile.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  :<span style={{fontSize:"30px"}}>👤</span>}
              </div>
              <div className="avatar-overlay">📷</div>
              <div className="dot" style={{position:"absolute",bottom:2,right:2,width:"9px",height:"9px",borderRadius:"50%"}}/>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarUpload}/>
            <div style={{fontFamily:"monospace",fontSize:"8px",opacity:.25,marginBottom:"8px"}}>tap to change photo</div>
            {/* Name */}
            {editingName?(
              <div style={{width:"100%",display:"flex",gap:"6px",alignItems:"center",marginBottom:"4px"}}>
                <input className="name-edit" value={nameInput} onChange={e=>setNameInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")saveName();if(e.key==="Escape")setEditingName(false);}} autoFocus
                  style={{color:isEva?"white":isSpark?"#9D174D":"#92400E",borderBottomColor:accent,fontFamily:isEva?"Share Tech Mono,monospace":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif"}}/>
                <button className="sbtn" style={{padding:"5px 10px",fontSize:"11px",borderRadius:"8px"}} onClick={saveName}>✓</button>
              </div>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"4px",cursor:"pointer"}} onClick={()=>setEditingName(true)}>
                <div style={{fontFamily:isEva?"Share Tech Mono,monospace":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif",fontSize:"17px",fontWeight:700,color:accent}}>{profile.full_name||"AGENT"}</div>
                <span style={{fontSize:"11px",opacity:.4}}>✏️</span>
              </div>
            )}
            <div style={{fontFamily:"monospace",fontSize:"10px",opacity:.4,marginBottom:"4px",textAlign:"center",wordBreak:"break-all",maxWidth:"100%"}}>{userEmail}</div>
            <div style={{fontFamily:"monospace",fontSize:"8px",opacity:.25,textTransform:"uppercase",marginBottom:"14px"}}>{profile.persona||"GENERAL"}</div>
            {/* XP */}
            <div style={{width:"100%",marginBottom:"14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                <span style={{fontFamily:"monospace",fontSize:"10px",color:accent}}>LVL {level}</span>
                <span style={{fontFamily:"monospace",fontSize:"9px",opacity:.35}}>{xp}/{nextLevelXP} XP</span>
              </div>
              <div className="xpbg"><div className="xpfg" style={{width:`${xpPct}%`}}/></div>
            </div>
            {/* Stats */}
            <div style={{width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:"12px"}}>
              {[{l:"LEVEL",v:level},{l:"STREAK",v:`${streak}🔥`},{l:"TASKS",v:`${tasks.filter(t=>t.completed).length}/${tasks.length}`},{l:"POKES",v:pokeCount},{l:"MSGS",v:messages.length},{l:"XP",v:xp}].map((s,i)=>(
                <div key={i} className="chip" style={{justifyContent:"space-between"}}><span className="chip-l">{s.l}</span><span className="chip-v">{s.v}</span></div>
              ))}
            </div>
            {/* Companion pref */}
            <div style={{width:"100%",padding:"10px",borderRadius:"12px",background:`rgba(${accentRgb},.06)`,border:`1px solid rgba(${accentRgb},.18)`,marginBottom:"12px"}}>
              <div style={{fontFamily:"monospace",fontSize:"7px",opacity:.35,textTransform:"uppercase",marginBottom:"8px"}}>DEFAULT COMPANION</div>
              <div style={{display:"flex",gap:"10px",justifyContent:"center",marginBottom:"5px"}}>
                {COMPANIONS.map(c=>(
                  <button key={c.id} onClick={()=>switchCompanion(c)} className={`cbn ${activeCompanion.id===c.id?"on":""} ${c.color}`}
                    style={{boxShadow:activeCompanion.id===c.id?`0 0 12px rgba(${c.accentRgb},.7)`:undefined}}/>
                ))}
              </div>
              <div style={{fontFamily:"Share Tech Mono,monospace",fontSize:"8px",opacity:.4,textTransform:"uppercase",textAlign:"center",letterSpacing:".1em"}}>SAVED: {activeCompanion.name.toUpperCase()}</div>
            </div>
            {quotaRemaining!==null && (
              <div style={{width:"100%",padding:"9px 12px",borderRadius:"8px",background:quotaRemaining<QUOTA_WARN?"rgba(239,68,68,.08)":"rgba(34,197,94,.06)",border:`1px solid ${quotaRemaining<QUOTA_WARN?"rgba(239,68,68,.3)":"rgba(34,197,94,.25)"}`,marginBottom:"10px"}}>
                <div style={{fontFamily:"monospace",fontSize:"8px",opacity:.4,textTransform:"uppercase",marginBottom:"3px"}}>VOICE QUOTA {activeKeyLabel?`(${activeKeyLabel})`:""}</div>
                <div style={{fontFamily:"Share Tech Mono,monospace",fontSize:"11px",color:quotaRemaining<QUOTA_WARN?"#FCA5A5":"#86EFAC"}}>{quotaRemaining.toLocaleString()} chars remaining</div>
              </div>
            )}
            <button onClick={()=>supabase.auth.signOut()} className="btn red" style={{marginTop:"auto",width:"100%",textAlign:"center",padding:"10px"}}>⏻ SIGN OUT</button>
          </div>
        </div>

        {/* BACKDROP */}
        {(isTaskOpen||isHistoryOpen||isProfileOpen)&&(
          <div onClick={()=>{setIsTaskOpen(false);setIsHistoryOpen(false);setIsProfileOpen(false);}}
            style={{position:"fixed",inset:0,zIndex:90,background:"rgba(0,0,0,.3)",backdropFilter:"blur(4px)"}}/>
        )}

        {/* ══ STATUS BAR ══ */}
        <div className={`sbar status-bar`}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",minWidth:0,flex:1}}>
            <svg width="16" height="16" viewBox="0 0 100 100" fill="none" style={{flexShrink:0}}>
              <polygon points="50,4 93,27.5 93,72.5 50,96 7,72.5 7,27.5" stroke={accent} strokeWidth="3" fill="none" opacity="0.9"/>
              <circle cx="50" cy="50" r="13" stroke={accent} strokeWidth="2.5" fill="none"/>
              <circle cx="50" cy="50" r="5.5" fill={accent}/>
            </svg>
            <span className="stxt" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {isEva?`AEGIS_v2.0 — ${activeCompanion.status}`:isSpark?`✨ AEGIS — ${activeCompanion.status}`:` Aegis — ${activeCompanion.status}`}
            </span>
          </div>
          <div style={{display:"flex",gap:"10px",flexShrink:0}}>
            {isMounted&&<span className="stxt" style={{opacity:.6}}>LVL {level} · {xp}XP · {streak}🔥</span>}
            {isMounted&&<span className="stxt" style={{opacity:.3,display:"none"}} className="stxt hide-mobile">{currentTime}</span>}
          </div>
        </div>

        {/* ══ MAIN CONTENT ══ */}
        <div className="main-content">

          {/* BRIEFING CARD */}
          {showBriefing && (
            <div className="briefcard">
              <div style={{padding:"16px 18px",borderRadius:isEva?"10px":isSpark?"22px":"24px",background:isEva?"rgba(0,0,0,.93)":"rgba(255,255,255,.97)",border:`2px solid rgba(${accentRgb},.4)`,boxShadow:`0 8px 30px rgba(${accentRgb},.18)`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                  <div style={{fontFamily:isEva?"Share Tech Mono,monospace":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif",fontSize:isEva?"9px":"13px",color:accent,fontWeight:700}}>
                    {isEva?"◆ DAILY_BRIEFING":isSpark?"🌸 HEY!! ✨":"☀️ Welcome back!"}
                  </div>
                  <button onClick={()=>setShowBriefing(false)} className="btn" style={{padding:"3px 7px",fontSize:"10px"}}>✕</button>
                </div>
                <div style={{fontSize:"12px",lineHeight:1.55,opacity:.75,fontFamily:isEva?"Rajdhani,sans-serif":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif"}}>
                  {lastMsg}
                </div>
                <div style={{display:"flex",gap:"6px",marginTop:"10px"}}>
                  <span style={{fontSize:"10px",padding:"3px 8px",borderRadius:"16px",background:`rgba(${accentRgb},.1)`,color:accent,fontFamily:"monospace"}}>🔥 {streak}d</span>
                  <span style={{fontSize:"10px",padding:"3px 8px",borderRadius:"16px",background:`rgba(${accentRgb},.1)`,color:accent,fontFamily:"monospace"}}>⚡ {tasks.length} tasks</span>
                </div>
              </div>
            </div>
          )}

          {/* HEADER */}
          <div className="header-row">
            <div style={{display:"flex",gap:"6px",flexShrink:0}}>
              <button onClick={()=>{playSound("click",theme);setIsTaskOpen(true);}} className="btn">{isEva?"GOALS":isSpark?"🎯":"🎯 Goals"}</button>
              <button onClick={()=>{playSound("click",theme);setIsHistoryOpen(true);}} className="btn">{isEva?"HISTORY":isSpark?"💬":"💬"}</button>
              <button onClick={()=>{if(confirm("Clear chat?"))setMessages([{role:"assistant",content:activeCompanion.greeting(profile.full_name||"Agent")}]);}} className="btn red">{isEva?"WIPE":"Wipe"}</button>
            </div>

            {/* Companion selector */}
            <div className="comp-selector">
              <div className="comp-btns" style={{background:isEva?"rgba(0,0,0,.65)":"rgba(255,255,255,.62)",border:`1px solid rgba(${accentRgb},.2)`}}>
                {COMPANIONS.map(c=>(
                  <button key={c.id} onClick={()=>switchCompanion(c)} className={`cbn ${activeCompanion.id===c.id?"on":""} ${c.color}`}
                    style={{boxShadow:activeCompanion.id===c.id?`0 0 12px rgba(${c.accentRgb},.7)`:undefined}}/>
                ))}
              </div>
              <div style={{fontFamily:"Share Tech Mono,monospace",fontSize:"8px",color:`rgba(${accentRgb},.6)`,letterSpacing:".12em",textTransform:"uppercase"}}>
                {activeCompanion.name} · {activeCompanion.label}
              </div>
            </div>

            <button onClick={()=>{playSound("click",theme);setIsProfileOpen(true);}} className="btn" style={{flexShrink:0}}>
              {isEva?"PROFILE":isSpark?"✨":"👤"}
            </button>
          </div>

          {/* CHAT BUBBLE */}
          <div className="chat-bubble-wrap">
            <div className="card msg-anim" style={{padding:isEva?"14px 18px":"16px 20px"}}>
              {isEva&&(
                <div style={{fontFamily:"Share Tech Mono,monospace",fontSize:"8px",color:`rgba(${accentRgb},.55)`,marginBottom:"8px",display:"flex",alignItems:"center",gap:"6px",textTransform:"uppercase",letterSpacing:".12em"}}>
                  <span>◆ EVA_OUTPUT</span>
                  {isLoading&&<span className="dots" style={{color:accent}}><span/><span/><span/></span>}
                </div>
              )}
              <div className="txt-main">
                {isLoading?(
                  <div style={{display:"flex",alignItems:"center",gap:"8px",justifyContent:isEva?"flex-start":"center",color:`rgba(${accentRgb},.7)`}}>
                    <span style={{fontSize:"12px",fontFamily:isEva?"Share Tech Mono,monospace":isSpark?"Bubblegum Sans,cursive":"Fredoka,sans-serif"}}>
                      {isSpark?"Sparkling... ✨":isEva?"PROCESSING...":"Thinking..."}
                    </span>
                    <span className="dots"><span/><span/><span/></span>
                  </div>
                ):<ReactMarkdown>{lastMsg}</ReactMarkdown>}
              </div>
            </div>
          </div>

          {/* COMPANION */}
          <div className="companion-wrap">
            <div className="companion-3d" style={{position:"relative"}} className={`companion-3d ${companionAnim?`ca-${companionAnim}`:""}`}>
              <div className="aura" style={{position:"absolute",inset:"-15%",borderRadius:"50%",pointerEvents:"none"}}/>
              <Companion3D activeColor={activeCompanion.color} isThinking={isLoading} companionId={activeCompanion.id} onPoke={handlePoke} lastPoke={lastPoke}/>
            </div>
          </div>
        </div>

        {/* ══ BOTTOM ══ */}
        <div className="bottom-section">
          <div className="stats-row">
            {[{l:"LVL",v:level},{l:"XP",v:xp},{l:"STREAK",v:`${streak}🔥`},{l:"TASKS",v:`${tasks.filter(t=>t.completed).length}/${tasks.length}`}].map((s,i)=>(
              <div key={i} className="chip"><span className="chip-l">{s.l}</span><span className="chip-v">{s.v}</span></div>
            ))}
          </div>
          <div style={{maxWidth:"600px",margin:"0 auto",width:"100%"}}>
            <div className="xpbg"><div className="xpfg" style={{width:`${xpPct}%`}}/></div>
          </div>
          <div className="ibar" style={{maxWidth:"640px",margin:"0 auto"}}>
            {isEva&&<span style={{fontFamily:"Share Tech Mono,monospace",fontSize:"9px",color:`rgba(${accentRgb},.45)`,flexShrink:0,paddingLeft:"8px"}}>▶</span>}
            <input value={inputText} onChange={e=>setInputText(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleSendMessage()}
              className="inp"
              placeholder={isEva?"AWAITING COMMAND...":isSpark?"tell me everything!! 💖":"Ask me anything..."}/>
            <button onClick={startListening} className={`mic ${isListening?"on":""}`}>🎤</button>
            <button onClick={()=>handleSendMessage()} className="sbtn">
              {isEva?"GO":isSpark?"SEND 💌":"Send ✦"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
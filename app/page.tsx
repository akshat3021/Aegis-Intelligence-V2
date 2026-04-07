"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "../lib/supabase";
import Companion3D from "../components/Companion3D";
import Auth from "../components/Auth";
import AppDownloadBanner from "../components/AppDownloadBanner";
import PomodoroTimer from "../components/PomodoroTimer";
import ShareCard from "../components/ShareCard";
import MobileDrawer from "../components/MobileDrawer";

// ─── FREE-TIER ELEVENLABS VOICE IDs ──────────────────────────────────────────
// These are the only voices that work on free ElevenLabs accounts.
// Library voices (from Voice Library) require a paid plan.
const COMPANIONS = [
  {
    id: "squish", name: "Squish", bgColor: "#FBBF24",
    accent: "#F59E0B", accentRgb: "245,158,11",
    voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel — warm friendly female ✅ FREE
    label: "FRIENDLY_UNIT", status: "HELPFUL MODE", theme: "squish",
    wakeWords: ["hey squish", "squish", "wake up"],
    greeting: (n: string) => `Hey ${n}! 💛 Squish is here and ready to help. What are we working on today?`,
    soundThemeDesc: "Warm lo-fi beats",
    moodKeywords: {
      stressed: ["Hey breathe! You got this 💛", "One step at a time~", "Let's tackle this together! 🤗"],
      happy:    ["Yay! I love your energy! ✨", "Let's gooo! 🎉", "Squishing with joy!"],
      focused:  ["Locked in! Let's crush it! 🎯", "Focus mode: ON 🔥", "You're in the zone!"],
    },
  },
  {
    id: "eva", name: "Eva", bgColor: "#64748B",
    accent: "#64748B", accentRgb: "100,116,139",
    voiceId: "pNInz6obpgDQGcFmaJgB", // Adam — deep authoritative male ✅ FREE
    label: "TECH_CORE", status: "ANALYTICAL MODE", theme: "eva",
    wakeWords: ["hey eva", "eva", "wake up", "aegis online"],
    greeting: (n: string) => `AEGIS_ONLINE. Agent ${n} detected. All systems nominal. Awaiting your command.`,
    soundThemeDesc: "Synthwave ambient",
    moodKeywords: {
      stressed: ["Recalibrating. Stress detected. Initiating calm protocols.", "Suggest task decomposition."],
      happy:    ["Positive sentiment logged. Optimal performance state active.", "Morale coefficient: high."],
      focused:  ["Deep focus mode engaged. Noise suppression: active.", "Concentration matrix: optimal."],
    },
  },
  {
    id: "spark", name: "Spark", bgColor: "#EC4899",
    accent: "#EC4899", accentRgb: "236,72,153",
    voiceId: "MF3mGyEYCl7XYWbV9V6O", // Elli — young energetic female ✅ FREE
    label: "MOTIVATOR", status: "HYPERDRIVE MODE", theme: "spark",
    wakeWords: ["hey spark", "spark", "wake up", "let's go"],
    greeting: (n: string) => `OMG ${n}!! 🎉✨ SPARK IS HERE AND WE ARE GOING TO HAVE THE BEST DAY EVER!! What's the plan?! 🚀💖`,
    soundThemeDesc: "Upbeat nature sounds",
    moodKeywords: {
      stressed: ["NOOO don't stress!! You're AMAZING!! 🌟💖", "Spark believes in you SO MUCH!! ✨"],
      happy:    ["OMG YESSS!! 🎉🎊 BEST DAY EVER!!", "WOOHOOO!! WE'RE THRIVING!! 🌈✨💥"],
      focused:  ["LETS. GO. 🔥🔥🔥 HYPERFOCUS ACTIVATED!!", "CONCENTRATION LEVEL: MAXIMUM!! 🚀💫"],
    },
  },
];

// ─── TYPES ───────────────────────────────────────────────────────────────────
type Mood = "stressed" | "happy" | "focused" | "neutral";
interface Task    { id: string; text: string; category: string; completed: boolean; }
interface Profile { full_name: string; persona: string; objective: string; avatar_url?: string; }
interface Msg     { role: "user" | "assistant"; content: string; isBriefing?: boolean; timestamp?: number; }

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function detectMood(t: string): Mood {
  const l = t.toLowerCase();
  if (/stress|overwhelm|tired|exhaust|anxious|can't|stuck|panic|fail|hard/.test(l)) return "stressed";
  if (/happy|great|awesome|yay|love|excit|amazing|good|yes|wow|thanks/.test(l)) return "happy";
  if (/focus|work|study|code|build|create|task|goal|deadline|project/.test(l)) return "focused";
  return "neutral";
}

function playUI(type: "click" | "send" | "poke" | "levelup" | "switch" | "briefing", theme: string) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === "click")    { osc.type = "sine";     osc.frequency.setValueAtTime(440, now); g.gain.setValueAtTime(.04, now); }
    if (type === "send")     { osc.type = "sine";     osc.frequency.setValueAtTime(theme === "spark" ? 1046 : theme === "eva" ? 660 : 880, now); g.gain.setValueAtTime(.06, now); }
    if (type === "poke")     { osc.type = "triangle"; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(150, now + .15); g.gain.setValueAtTime(.08, now); }
    if (type === "switch")   { osc.type = "sine";     osc.frequency.setValueAtTime(660, now); osc.frequency.setValueAtTime(880, now + .08); g.gain.setValueAtTime(.06, now); }
    if (type === "levelup")  { osc.type = "sine"; [523, 659, 784, 1046].forEach((f, i) => osc.frequency.setValueAtTime(f, now + i * .1)); g.gain.setValueAtTime(.12, now); }
    if (type === "briefing") { osc.type = "sine";     osc.frequency.setValueAtTime(523, now); osc.frequency.setValueAtTime(659, now + .12); g.gain.setValueAtTime(.08, now); }
    g.gain.exponentialRampToValueAtTime(.001, now + .35);
    osc.start(now); osc.stop(now + .35);
  } catch (_) {}
}

const getLvl = (xp: number) => Math.floor(Math.pow(xp / 80, .6)) + 1;
const getXPForLvl = (l: number) => Math.ceil(Math.pow(l - 1, 1.667) * 80);

// ─── THEME TOKENS ─────────────────────────────────────────────────────────────
const T = {
  squish: {
    bg: "linear-gradient(145deg,#FFFBEB 0%,#FEF3C7 55%,#FDE68A 100%)", font: "'Fredoka',sans-serif", fg: "#1F2937", muted: "rgba(120,53,15,.45)",
    card:      { background: "rgba(255,255,255,.92)", borderRadius: "20px", border: "2px solid rgba(245,158,11,.22)", boxShadow: "0 6px 24px rgba(245,158,11,.1)", backdropFilter: "blur(16px)" },
    briefCard: { background: "rgba(255,248,215,.97)", borderRadius: "20px", border: "2px solid rgba(245,158,11,.4)", boxShadow: "0 8px 28px rgba(245,158,11,.15)" },
    ibar:      { background: "rgba(255,255,255,.95)", borderRadius: "50px", border: "2px solid rgba(245,158,11,.4)", boxShadow: "0 4px 16px rgba(245,158,11,.1)" },
    sbar:      { background: "rgba(255,251,235,.94)", borderBottom: "1.5px solid rgba(245,158,11,.2)" },
    chip:      { background: "rgba(255,255,255,.85)", borderRadius: "20px", border: "1.5px solid rgba(245,158,11,.25)" },
    chipL:     { fontFamily: "'Fredoka',sans-serif", fontSize: "10px", color: "rgba(120,53,15,.45)" },
    chipV:     { fontFamily: "'Fredoka',sans-serif", fontSize: "13px", fontWeight: "600", color: "#92400E" },
    sbtn:      { background: "#F59E0B", color: "white", border: "none", borderRadius: "40px", fontFamily: "'Fredoka',sans-serif", fontWeight: "700", fontSize: "14px", boxShadow: "0 4px 12px rgba(245,158,11,.35)" },
    muser:     { background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.2)", borderRadius: "14px" },
    mbot:      { background: "white", border: "1px solid rgba(245,158,11,.12)", borderRadius: "14px" },
    aura:      "radial-gradient(ellipse,rgba(245,158,11,.18) 0%,transparent 70%)",
    xpbg:      "rgba(245,158,11,.15)", xpfg: "linear-gradient(90deg,#F59E0B,#FCD34D)",
    dot:       { background: "#F59E0B", boxShadow: "0 0 8px rgba(245,158,11,.9)" },
    ph:        "rgba(120,53,15,.32)",
    mic:       { background: "rgba(245,158,11,.1)", border: "2px solid rgba(245,158,11,.3)" },
    compBox:   { background: "rgba(255,255,255,.72)", border: "1px solid rgba(245,158,11,.22)", backdropFilter: "blur(10px)" },
    txt:       { fontFamily: "'Fredoka',sans-serif", fontSize: "15px", fontWeight: "500", color: "#374151", textAlign: "center" as const, lineHeight: "1.6" },
    briefTxt:  { fontFamily: "'Fredoka',sans-serif", fontSize: "14px", color: "#78350F", lineHeight: "1.6" },
    stxt:      { fontFamily: "'Fredoka',sans-serif", fontSize: "12px", color: "rgba(120,53,15,.55)" },
    ptitle:    { fontFamily: "'Fredoka',sans-serif", fontSize: "18px", fontWeight: "700", color: "#92400E" },
    panelBtn:  { background: "rgba(255,255,255,.82)", border: "2px solid rgba(245,158,11,.3)", color: "#92400E", borderRadius: "50px", fontFamily: "'Fredoka',sans-serif", fontWeight: "600", fontSize: "12px" },
    panelBtnR: { background: "rgba(255,255,255,.82)", border: "2px solid rgba(220,38,38,.3)", color: "#DC2626", borderRadius: "50px", fontFamily: "'Fredoka',sans-serif", fontWeight: "600", fontSize: "12px" },
  },
  spark: {
    bg: "linear-gradient(135deg,#FFF0F6 0%,#FCE4EC 50%,#F8BBD0 100%)", font: "'Bubblegum Sans',cursive", fg: "#1F2937", muted: "rgba(157,23,77,.45)",
    card:      { background: "rgba(255,255,255,.92)", borderRadius: "20px", border: "2px solid rgba(236,72,153,.28)", boxShadow: "3px 3px 0 rgba(236,72,153,.15),0 6px 24px rgba(236,72,153,.1)", backdropFilter: "blur(16px)" },
    briefCard: { background: "rgba(255,228,240,.97)", borderRadius: "20px", border: "2px solid rgba(236,72,153,.45)", boxShadow: "3px 3px 0 rgba(236,72,153,.22),0 8px 28px rgba(236,72,153,.15)" },
    ibar:      { background: "rgba(255,255,255,.95)", borderRadius: "24px", border: "2px solid rgba(236,72,153,.42)", boxShadow: "2px 2px 0 rgba(236,72,153,.15)" },
    sbar:      { background: "rgba(255,240,246,.94)", borderBottom: "1.5px solid rgba(236,72,153,.2)" },
    chip:      { background: "rgba(255,255,255,.85)", borderRadius: "14px", border: "1.5px solid rgba(236,72,153,.2)" },
    chipL:     { fontFamily: "'Bubblegum Sans',cursive", fontSize: "10px", color: "rgba(157,23,77,.5)" },
    chipV:     { fontFamily: "'Bubblegum Sans',cursive", fontSize: "13px", fontWeight: "400", color: "#9D174D" },
    sbtn:      { background: "linear-gradient(135deg,#EC4899,#F472B6)", color: "white", border: "none", borderRadius: "18px", fontFamily: "'Bubblegum Sans',cursive", fontWeight: "400", fontSize: "14px", boxShadow: "2px 2px 0 rgba(236,72,153,.28)" },
    muser:     { background: "rgba(236,72,153,.08)", border: "1px solid rgba(236,72,153,.2)", borderRadius: "14px" },
    mbot:      { background: "white", border: "1px solid rgba(236,72,153,.15)", borderRadius: "14px" },
    aura:      "radial-gradient(ellipse,rgba(236,72,153,.16) 0%,transparent 70%)",
    xpbg:      "rgba(236,72,153,.12)", xpfg: "linear-gradient(90deg,#EC4899,#F472B6,#FB7185)",
    dot:       { background: "#EC4899", boxShadow: "0 0 8px rgba(236,72,153,1)" },
    ph:        "rgba(131,24,67,.3)",
    mic:       { background: "rgba(236,72,153,.1)", border: "2px solid rgba(236,72,153,.35)" },
    compBox:   { background: "rgba(255,255,255,.72)", border: "1px solid rgba(236,72,153,.22)", backdropFilter: "blur(10px)" },
    txt:       { fontFamily: "'Bubblegum Sans',cursive", fontSize: "16px", fontWeight: "400", color: "#374151", textAlign: "center" as const, lineHeight: "1.6" },
    briefTxt:  { fontFamily: "'Bubblegum Sans',cursive", fontSize: "15px", color: "#9D174D", lineHeight: "1.6" },
    stxt:      { fontFamily: "'Bubblegum Sans',cursive", fontSize: "12px", color: "rgba(157,23,77,.6)" },
    ptitle:    { fontFamily: "'Bubblegum Sans',cursive", fontSize: "18px", fontWeight: "400", color: "#9D174D" },
    panelBtn:  { background: "rgba(255,255,255,.82)", border: "2px solid rgba(236,72,153,.32)", color: "#9D174D", borderRadius: "16px", fontFamily: "'Bubblegum Sans',cursive", fontWeight: "400", fontSize: "12px" },
    panelBtnR: { background: "rgba(255,255,255,.82)", border: "2px solid rgba(220,38,38,.3)", color: "#DC2626", borderRadius: "16px", fontFamily: "'Bubblegum Sans',cursive", fontWeight: "400", fontSize: "12px" },
  },
  eva: {
    bg: "#050508", font: "'Rajdhani',sans-serif", fg: "rgba(255,255,255,.82)", muted: "rgba(255,255,255,.3)",
    card:      { background: "rgba(0,0,0,.82)", borderRadius: "10px", border: "1px solid rgba(100,116,139,.22)", boxShadow: "0 0 28px rgba(100,116,139,.07)", backdropFilter: "blur(20px)" },
    briefCard: { background: "rgba(6,10,18,.95)", borderRadius: "10px", border: "2px solid rgba(100,116,139,.4)", boxShadow: "0 0 36px rgba(100,116,139,.12)" },
    ibar:      { background: "rgba(0,0,0,.9)", borderRadius: "8px", border: "1px solid rgba(100,116,139,.32)" },
    sbar:      { background: "rgba(100,116,139,.05)", borderBottom: "1px solid rgba(100,116,139,.18)" },
    chip:      { background: "rgba(100,116,139,.06)", borderRadius: "3px", border: "1px solid rgba(100,116,139,.18)" },
    chipL:     { fontFamily: "'Share Tech Mono',monospace", fontSize: "7px", color: "rgba(255,255,255,.22)", letterSpacing: ".12em" },
    chipV:     { fontFamily: "'Share Tech Mono',monospace", fontSize: "10px", fontWeight: "400", color: "#94A3B8" },
    sbtn:      { background: "#475569", color: "white", border: "none", borderRadius: "4px", fontFamily: "'Share Tech Mono',monospace", fontWeight: "700", fontSize: "10px", letterSpacing: ".15em", textTransform: "uppercase" as const, clipPath: "polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)" },
    muser:     { background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.05)", borderRadius: "6px" },
    mbot:      { background: "rgba(100,116,139,.05)", border: "1px solid rgba(100,116,139,.12)", borderRadius: "6px" },
    aura:      "radial-gradient(ellipse,rgba(100,116,139,.1) 0%,transparent 70%)",
    xpbg:      "rgba(100,116,139,.1)", xpfg: "linear-gradient(90deg,#475569,#94A3B8)",
    dot:       { background: "#64748B", boxShadow: "0 0 8px rgba(100,116,139,.9)" },
    ph:        "rgba(255,255,255,.18)",
    mic:       { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.12)" },
    compBox:   { background: "rgba(0,0,0,.65)", border: "1px solid rgba(100,116,139,.2)", backdropFilter: "blur(10px)" },
    txt:       { fontFamily: "'Rajdhani',sans-serif", fontSize: "14px", fontWeight: 400, color: "rgba(255,255,255,.82)", textAlign: "left" as const, lineHeight: "1.65", letterSpacing: ".02em" },
    briefTxt:  { fontFamily: "'Rajdhani',sans-serif", fontSize: "13px", color: "rgba(100,200,255,.85)", lineHeight: "1.65", letterSpacing: ".02em" },
    stxt:      { fontFamily: "'Share Tech Mono',monospace", fontSize: "8px", color: "rgba(100,116,139,.7)", letterSpacing: ".15em", textTransform: "uppercase" as const },
    ptitle:    { fontFamily: "'Share Tech Mono',monospace", fontSize: "11px", fontWeight: "700", color: "#64748B", letterSpacing: ".2em", textTransform: "uppercase" as const },
    panelBtn:  { background: "rgba(255,255,255,.04)", border: "1px solid rgba(100,116,139,.28)", color: "rgba(255,255,255,.45)", borderRadius: "3px", fontFamily: "'Share Tech Mono',monospace", fontWeight: "700", fontSize: "9px", letterSpacing: ".15em", textTransform: "uppercase" as const },
    panelBtnR: { background: "rgba(255,255,255,.04)", border: "1px solid rgba(239,68,68,.2)", color: "rgba(239,68,68,.6)", borderRadius: "3px", fontFamily: "'Share Tech Mono',monospace", fontWeight: "700", fontSize: "9px", letterSpacing: ".15em", textTransform: "uppercase" as const },
  },
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function Home() {
  const [session, setSession]                 = useState<any>(null);
  const [authLoading, setAuthLoading]         = useState(true);
  const [profile, setProfile]                 = useState<Profile>({ full_name: "", persona: "General", objective: "" });
  const [editingName, setEditingName]         = useState(false);
  const [nameInput, setNameInput]             = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [messages, setMessages]               = useState<Msg[]>([]);
  const [tasks, setTasks]                     = useState<Task[]>([]);
  const [newTaskText, setNewTaskText]         = useState("");
  const [isLoading, setIsLoading]             = useState(false);
  const [inputText, setInputText]             = useState("");
  const [activeCompanion, setActiveCompanion] = useState(COMPANIONS[0]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isTaskOpen, setIsTaskOpen]           = useState(false);
  const [isProfileOpen, setIsProfileOpen]     = useState(false);
  const [isHistoryOpen, setIsHistoryOpen]     = useState(false);
  const [drawerOpen, setDrawerOpen]           = useState(false);
  const [isListening, setIsListening]         = useState(false);
  const [pokeCount, setPokeCount]             = useState(0);
  const [lastPoke, setLastPoke]               = useState(0);
  const [isMounted, setIsMounted]             = useState(false);
  const [currentMood, setCurrentMood]         = useState<Mood>("neutral");
  const [moodMessage, setMoodMessage]         = useState("");
  const [showMoodBanner, setShowMoodBanner]   = useState(false);
  const [xp, setXP]                           = useState(0);
  const [streak, setStreak]                   = useState(1);
  const [showLevelUp, setShowLevelUp]         = useState(false);
  const [levelUpNum, setLevelUpNum]           = useState(1);
  const [companionAnim, setCompanionAnim]     = useState<"" | "bounce" | "wave">("");
  const [quotaRemaining, setQuotaRemaining]   = useState<number | null>(null);
  const [moodHistory, setMoodHistory]         = useState<{ mood: Mood; date: string }[]>([]);
  const [showPomodoro, setShowPomodoro]       = useState(false);
  const [showShareCard, setShowShareCard]     = useState(false);
  const [expandChat, setExpandChat]           = useState(false);
  const [soundOn, setSoundOn]                 = useState(false);
  const [isMobile, setIsMobile]               = useState(false);
  const [notifStatus, setNotifStatus]         = useState<"idle"|"granted"|"denied">("idle");

  const prevLevelRef   = useRef(1);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const greetingSetRef = useRef(false);
  const soundRef       = useRef<AudioContext | null>(null);
  const soundNodesRef  = useRef<any[]>([]);

  const { accent, accentRgb, theme } = activeCompanion;
  const ts      = T[theme as keyof typeof T];
  const level   = getLvl(xp);
  const nxtXP   = getXPForLvl(level + 1);
  const curXP   = getXPForLvl(level);
  const xpPct   = Math.min(100, ((xp - curXP) / (nxtXP - curXP)) * 100);
  const isEva   = theme === "eva", isSpark = theme === "spark";
  const doneTasks = tasks.filter(t => t.completed).length;

  // ── MOUNT ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsMounted(true);
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    const saved = localStorage.getItem("aegis_companion");
    if (saved) { const f = COMPANIONS.find(c => c.id === saved); if (f) setActiveCompanion(f); }
    setMoodHistory(JSON.parse(localStorage.getItem("aegis_mood_history") || "[]"));
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "granted") setNotifStatus("granted");
      else if (Notification.permission === "denied") setNotifStatus("denied");
    }
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── XP / STREAK ────────────────────────────────────────────────────────────
  useEffect(() => {
    const sx = parseInt(localStorage.getItem("aegis_xp") || "0");
    const ss = parseInt(localStorage.getItem("aegis_streak") || "1");
    const ld = localStorage.getItem("aegis_last_date");
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    setXP(sx); prevLevelRef.current = getLvl(sx);
    if (ld !== today) {
      const ns = ld === yesterday ? ss + 1 : ld ? 1 : ss;
      setStreak(ns); localStorage.setItem("aegis_streak", String(ns)); localStorage.setItem("aegis_last_date", today);
    } else setStreak(ss);
  }, []);

  useEffect(() => {
    if (xp === 0) return;
    localStorage.setItem("aegis_xp", String(xp));
    const nl = getLvl(xp);
    if (nl > prevLevelRef.current) {
      setLevelUpNum(nl); setShowLevelUp(true); playUI("levelup", theme);
      prevLevelRef.current = nl; setTimeout(() => setShowLevelUp(false), 3500);
    }
  }, [xp]);

  const addXP = useCallback((n: number) => setXP(p => p + n), []);

  // ── SESSION ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => { setSession(s); setAuthLoading(false); });
    return () => subscription.unsubscribe();
  }, []);

  // ── DATA FETCH + CHAT HISTORY FROM SUPABASE ───────────────────────────────
  useEffect(() => {
    if (!session || greetingSetRef.current) return;
    greetingSetRef.current = true;
    (async () => {
      const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (pData) { setProfile(pData); setNameInput(pData.full_name || ""); }
      const { data: tData } = await supabase.from("tasks").select("*").order("created_at", { ascending: true });
      if (tData) setTasks(tData);

      const savedCompId = localStorage.getItem("aegis_companion");
      const companion = COMPANIONS.find(c => c.id === savedCompId) || COMPANIONS[0];
      setActiveCompanion(companion);

      const name    = pData?.full_name || "Agent";
      const hour    = new Date().getHours();
      const tod     = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
      const str     = parseInt(localStorage.getItem("aegis_streak") || "1");
      const pending = (tData || []).filter((t: Task) => !t.completed).length;

      // Mood memory check
      const mh: any[] = JSON.parse(localStorage.getItem("aegis_mood_history") || "[]");
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const wasStressed = mh.some((m: any) => m.date === yesterday && m.mood === "stressed");
      const moodCheck = wasStressed
        ? `\n\n${companion.id === "eva" ? "Memory log: Elevated stress detected yesterday. Status check required." : companion.id === "spark" ? "OMG also — you seemed a bit stressed yesterday!! How are you feeling TODAY?? 💕" : "Also — you seemed stressed yesterday. How are you feeling today? 💛"}`
        : "";

      const briefMsg = `Good ${tod}, ${name}! 🌅 ${(tData || []).length} tasks (${pending} pending) · Streak: ${str} days 🔥${moodCheck}`;

      // ── LOAD CHAT HISTORY FROM SUPABASE ────────────────────────────────────
      // This enables cross-device chat persistence
      try {
        const { data: msgData } = await supabase
          .from("messages")
          .select("role, content, created_at")
          .eq("user_id", session.user.id)
          .eq("companion_id", companion.id)
          .order("created_at", { ascending: true })
          .limit(30);

        if (msgData && msgData.length > 0) {
          // Has history — prepend briefing, then show past messages
          const historicalMsgs: Msg[] = msgData.map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            isBriefing: false,
            timestamp: new Date(m.created_at).getTime(),
          }));
          setMessages([
            { role: "assistant", content: briefMsg, isBriefing: true, timestamp: Date.now() },
            ...historicalMsgs,
          ]);
        } else {
          // No history — fresh greeting
          setMessages([
            { role: "assistant", content: briefMsg, isBriefing: true, timestamp: Date.now() },
            { role: "assistant", content: companion.greeting(name), isBriefing: false, timestamp: Date.now() + 1 },
          ]);
        }
      } catch {
        // Fallback if messages table doesn't exist yet
        setMessages([
          { role: "assistant", content: briefMsg, isBriefing: true, timestamp: Date.now() },
          { role: "assistant", content: companion.greeting(name), isBriefing: false, timestamp: Date.now() + 1 },
        ]);
      }
      playUI("briefing", "squish");
    })();
  }, [session]);

  // ── SOUND ──────────────────────────────────────────────────────────────────
  const startSound = useCallback(() => {
    try {
      if (soundRef.current) return;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      soundRef.current = ctx; const nodes: any[] = [];
      if (activeCompanion.id === "squish") {
        [130.81, 164.81, 196].forEach(freq => {
          const osc = ctx.createOscillator(), gain = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
          lfo.frequency.value = 0.3; lg.gain.value = 2; lfo.connect(lg); lg.connect(osc.frequency);
          osc.type = "triangle"; osc.frequency.value = freq; gain.gain.value = 0.04;
          osc.connect(gain); gain.connect(ctx.destination); osc.start(); lfo.start(); nodes.push(osc, lfo);
        });
      } else if (activeCompanion.id === "eva") {
        [55, 82.41, 110].forEach(freq => {
          const osc = ctx.createOscillator(), gain = ctx.createGain();
          osc.type = "sawtooth"; osc.frequency.value = freq; gain.gain.value = 0;
          gain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 2);
          osc.connect(gain); gain.connect(ctx.destination); osc.start(); nodes.push(osc);
        });
      } else {
        const notes = [523.25, 659.25, 783.99, 1046.5]; let i = 0;
        const play = () => {
          const osc = ctx.createOscillator(), gain = ctx.createGain();
          osc.type = "sine"; osc.frequency.value = notes[i++ % notes.length];
          gain.gain.setValueAtTime(0.05, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.4);
        };
        const iv = setInterval(play, 600); nodes.push({ stop: () => clearInterval(iv) });
      }
      soundNodesRef.current = nodes;
    } catch (_) {}
  }, [activeCompanion.id]);

  const stopSound = useCallback(() => {
    soundNodesRef.current.forEach(n => { try { n.stop?.(); } catch (_) {} });
    soundNodesRef.current = []; soundRef.current?.close(); soundRef.current = null;
  }, []);

  const toggleSound = () => { if (soundOn) { stopSound(); setSoundOn(false); } else { startSound(); setSoundOn(true); } };
  useEffect(() => { if (soundOn) { stopSound(); setSoundOn(false); } }, [activeCompanion.id]);

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────
  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifStatus(perm === "granted" ? "granted" : "denied");
    if (perm === "granted") {
      new Notification("Aegis Intelligence", {
        body: `${activeCompanion.name} is ready to help you! 🎉`,
        icon: "/aegis-logo.svg",
      });
    }
  };

  // ── COMPANION SWITCH ───────────────────────────────────────────────────────
  const switchCompanion = (c: typeof COMPANIONS[0]) => {
    if (c.id === activeCompanion.id) return;
    playUI("switch", c.theme); setIsTransitioning(true);
    setTimeout(() => { setActiveCompanion(c); localStorage.setItem("aegis_companion", c.id); setIsTransitioning(false); }, 380);
  };

  // ── PROFILE ────────────────────────────────────────────────────────────────
  const saveName = async () => {
    if (!nameInput.trim() || !session) return;
    await supabase.from("profiles").update({ full_name: nameInput.trim() }).eq("id", session.user.id);
    setProfile(p => ({ ...p, full_name: nameInput.trim() })); setEditingName(false);
  };
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !session) return;
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${session.user.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = data.publicUrl + "?t=" + Date.now();
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", session.user.id);
      setProfile(p => ({ ...p, avatar_url: url }));
    } catch { alert("Upload failed. Create 'avatars' bucket in Supabase Storage → public."); }
    setAvatarUploading(false);
  };

  // ── TASKS ──────────────────────────────────────────────────────────────────
  const handleAddTask = async () => {
    if (!newTaskText.trim() || !session) return;
    const { data, error } = await supabase.from("tasks").insert({ text: newTaskText.trim(), category: "general", completed: false, user_id: session.user.id }).select().single();
    if (!error && data) { setTasks(p => [...p, data]); setNewTaskText(""); addXP(25); }
  };
  const handleToggleTask = async (task: Task) => {
    await supabase.from("tasks").update({ completed: !task.completed }).eq("id", task.id);
    setTasks(p => p.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
  };

  // ── POKE ───────────────────────────────────────────────────────────────────
  const handlePoke = () => {
    playUI("poke", theme); setLastPoke(Date.now()); setCompanionAnim("bounce"); addXP(2);
    setTimeout(() => setCompanionAnim(""), 700);
    setPokeCount(p => {
      const n = p + 1;
      if (n >= 5) { handleSendMessage(isEva ? "Touch sensors malfunctioning. Cease contact." : isSpark ? "STOPPP ITTTTT 😤" : "Hey! Stop poking me! 😅", false); return 0; }
      return n;
    });
  };

  // ── VOICE ──────────────────────────────────────────────────────────────────
  const startListening = () => {
    playUI("click", theme);
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { alert("Use Chrome for voice recognition."); return; }
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = "en-US";
    rec.onstart = () => setIsListening(true);
    rec.onerror = () => setIsListening(false);
    rec.onend   = () => setIsListening(false);
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript.toLowerCase().trim();
      const matched = COMPANIONS.find(c => c.wakeWords.some(w => t.includes(w)));
      if (matched) {
        if (matched.id !== activeCompanion.id) { switchCompanion(matched); setTimeout(() => handleSendMessage(matched.greeting(profile.full_name || "Agent"), false), 500); }
        else handleSendMessage(`${activeCompanion.name} activated!`, false);
      } else { handleSendMessage(e.results[0][0].transcript); }
    };
    rec.start();
  };

  // ── SEND MESSAGE (with Supabase persistence) ──────────────────────────────
  const handleSendMessage = async (override?: string, isSilent = false) => {
    const text = override || inputText;
    if (!text.trim()) return;
    playUI("send", theme); setIsLoading(true);
    if (!override) setInputText("");
    const mood = detectMood(text);

    // Save mood history
    if (mood !== "neutral") {
      const today = new Date().toDateString();
      const mh: any[] = JSON.parse(localStorage.getItem("aegis_mood_history") || "[]");
      const updated = [...mh.filter((m: any) => m.date !== today), { mood, date: today }].slice(-30);
      localStorage.setItem("aegis_mood_history", JSON.stringify(updated));
      setMoodHistory(updated);
    }
    if (mood !== "neutral" && mood !== currentMood) {
      setCurrentMood(mood);
      const opts = activeCompanion.moodKeywords[mood];
      setMoodMessage(opts[Math.floor(Math.random() * opts.length)]);
      setShowMoodBanner(true); setTimeout(() => setShowMoodBanner(false), 4200);
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          companionId: activeCompanion.id,
          chatHistory: messages.filter(m => !m.isBriefing).slice(-10), // exclude briefing from context
          userProfile: profile,
          currentMood: mood,
          moodHistory: moodHistory.slice(-7),
          userId: session?.user?.id, // ← enables DB persistence
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      // Update local state (DB is saved by the API route)
      setMessages(p => [...p,
        { role: "user",      content: text,       timestamp: Date.now() },
        { role: "assistant", content: data.reply,  timestamp: Date.now() + 1 },
      ]);
      addXP(10); setCompanionAnim("wave"); setTimeout(() => setCompanionAnim(""), 700);
      if (!isSilent) speakText(data.reply, activeCompanion);
    } catch (e) {
      console.error(e);
      setMessages(p => [...p,
        { role: "user",      content: text },
        { role: "assistant", content: "Sorry, couldn't connect. Check your internet." },
      ]);
    } finally { setIsLoading(false); }
  };

  // ── TTS ────────────────────────────────────────────────────────────────────
  const speakText = async (text: string, c: typeof COMPANIONS[0]) => {
    const clean = text.replace(/\[.*?\]/g, "").replace(/[*_#`~]/g, "").trim().slice(0, 500);
    if (!clean) return;
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: clean,
          voiceId: c.voiceId,     // free premade voice ID
          companionId: c.id,      // used as fallback resolver in route
        }),
      });
      const rem = res.headers.get("X-EL-Remaining");
      if (rem) setQuotaRemaining(parseInt(rem));
      if (!res.ok) { browserTTS(clean, c.id); return; }
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("audio")) {
        const blob = await res.blob();
        if (blob.size < 100) { browserTTS(clean, c.id); return; }
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        if (c.id === "eva")   audio.playbackRate = 0.85;
        if (c.id === "spark") audio.playbackRate = 1.15;
        audio.onended = () => URL.revokeObjectURL(url);
        audio.onerror = () => browserTTS(clean, c.id);
        const p = audio.play(); if (p) p.catch(() => browserTTS(clean, c.id));
      } else { browserTTS(clean, c.id); }
    } catch { browserTTS(clean, c.id); }
  };

  const browserTTS = (text: string, id: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 200));
    const v = window.speechSynthesis.getVoices();
    if (id === "eva")        { u.rate = 0.82; u.pitch = 0.65; const vv = v.find(x => /daniel|george|male/i.test(x.name)); if (vv) u.voice = vv; }
    else if (id === "spark") { u.rate = 1.2;  u.pitch = 1.75; const vv = v.find(x => /samantha|female/i.test(x.name)); if (vv) u.voice = vv; }
    else                     { u.rate = 1.0;  u.pitch = 1.2; }
    window.speechSynthesis.speak(u);
  };

  // ── GUARDS ─────────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ height: "100dvh", background: "#050508", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
      <svg width="56" height="56" viewBox="0 0 100 100" fill="none" style={{ animation: "spin 3s linear infinite" }}>
        <polygon points="50,4 93,27.5 93,72.5 50,96 7,72.5 7,27.5" stroke="#F59E0B" strokeWidth="2.5" fill="none" />
        <circle cx="50" cy="50" r="14" stroke="#F59E0B" strokeWidth="2" fill="none" />
        <circle cx="50" cy="50" r="6" fill="#F59E0B" />
      </svg>
      <p style={{ fontFamily: "monospace", fontSize: "11px", color: "#F59E0B", letterSpacing: ".35em" }}>INITIALIZING AEGIS...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!session) return <Auth />;

  const chatMessages  = messages.filter(m => !m.isBriefing);
  const briefingMsg   = messages.find(m => m.isBriefing);
  const lastChatMsg   = chatMessages.slice().reverse().find(m => m.role === "assistant")?.content || "";

  const panelStyle = (open: boolean, side: "left" | "right"): React.CSSProperties => ({
    position: "fixed", top: 0, height: "100%", width: "min(300px,88vw)", zIndex: 110,
    transition: "transform 0.4s cubic-bezier(0.23,1,0.32,1)",
    transform: open ? "translateX(0)" : side === "left" ? "translateX(-110%)" : "translateX(110%)",
    [side]: 0, display: "flex", flexDirection: "column", overflowY: "hidden",
    background: isEva ? "rgba(2,2,6,.97)" : isSpark ? "rgba(255,240,246,.98)" : "rgba(255,251,235,.98)",
    ...(side === "left" ? { borderRight: `1px solid rgba(${accentRgb},.2)` } : { borderLeft: `1px solid rgba(${accentRgb},.2)` }),
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Bubblegum+Sans&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pd{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes ap{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
        @keyframes bd{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
        @keyframes mi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mbin{from{opacity:0;transform:translateX(-50%) translateY(-14px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes mbout{to{opacity:0;transform:translateX(-50%) translateY(-14px)}}
        @keyframes lu{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}15%{opacity:1;transform:translate(-50%,-60%) scale(1.1)}85%{opacity:1;transform:translate(-50%,-60%) scale(1)}100%{opacity:0;transform:translate(-50%,-78%) scale(.9)}}
        @keyframes fl{0%{opacity:0}50%{opacity:1}100%{opacity:0}}
        @keyframes bc{0%,100%{transform:translateY(0)}35%{transform:translateY(-16px)}65%{transform:translateY(-6px)}}
        @keyframes wv{0%,100%{transform:rotate(0)}25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}
        @keyframes sq1{0%,100%{transform:translate(0,0)}50%{transform:translate(-12px,16px)}}
        @keyframes sq2{0%,100%{transform:translate(0,0)}50%{transform:translate(10px,-12px)}}
        @keyframes sd{from{background-position:0 0}to{background-position:30px 30px}}
        @keyframes sf{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes er{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(360deg)}}
        @keyframes esw{0%{top:15%;opacity:0}10%{opacity:1}90%{opacity:1}100%{top:85%;opacity:0}}
        .ai::placeholder{color:var(--ph);}
        .nsc::-webkit-scrollbar{display:none;}.nsc{scrollbar-width:none;-webkit-overflow-scrolling:touch;}
        input{font-size:16px!important;}
        @media(min-width:768px){input{font-size:14px!important;}}
        button{transition:opacity .15s;}button:active{opacity:.8;}

        /* ════════════════════════════════════════════
           RESPONSIVE LAYOUT
           Mobile: stacked (chat top, companion below)
           Desktop: chat LEFT (fixed 420px) | companion RIGHT (all remaining)
        ════════════════════════════════════════════ */
        .app-shell{
          display:flex;flex-direction:column;
          height:100vh;height:100dvh;
          width:100%;overflow:hidden;position:relative;
        }
        .main-area{
          flex:1;display:flex;flex-direction:column;
          align-items:center;position:relative;
          overflow:hidden;min-height:0;
        }
        .chat-col{width:100%;padding:0;flex-shrink:0;display:flex;flex-direction:column;}
        .companion-col{flex:1;display:flex;align-items:center;justify-content:center;min-height:0;}
        .companion-inner{width:clamp(160px,42vw,260px);height:clamp(160px,42vw,260px);}
        .briefing-wrap{padding:0 12px 8px;}
        .chat-wrap{padding:0 12px;}

        /* Desktop overrides */
        @media(min-width:768px){
          .main-area{flex-direction:row;align-items:stretch;}

          /* Chat: fixed 420px on the left */
          .chat-col{
            width:420px;flex-shrink:0;
            display:flex;flex-direction:column;
            border-right:1px solid rgba(128,128,128,.08);
          }

          /* Companion: takes ALL remaining space */
          .companion-col{
            flex:1;
            display:flex;align-items:center;justify-content:center;
            padding:24px;min-height:0;
          }

          /* Companion 3D: large on desktop */
          .companion-inner{
            width:min(520px,62vh);
            height:min(520px,62vh);
          }

          .briefing-wrap{padding:0 20px 10px;}
          .chat-wrap{padding:0 20px;}
        }

        /* Bottom bar */
        .bottom-bar{flex-shrink:0;width:100%;padding:6px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:6px;}
        @media(min-width:768px){.bottom-bar{padding:8px 24px;padding-bottom:max(16px,env(safe-area-inset-bottom));}}

        /* Input row */
        .input-row{display:flex;gap:8px;align-items:center;padding:8px 8px 8px 14px;width:100%;max-width:700px;margin:0 auto;}
        .input-grow{flex:1;min-width:0;background:transparent;border:none;outline:none;}

        /* Stats row */
        .stats-row{display:flex;gap:5px;justify-content:center;overflow-x:auto;flex-wrap:nowrap;}
        .stats-row::-webkit-scrollbar{display:none;}

        /* Header */
        .hdr{width:100%;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;gap:6px;z-index:50;flex-shrink:0;}
        @media(min-width:768px){.hdr{padding:10px 20px;}}

        /* Hamburger — mobile only */
        .ham-btn{display:flex;flex-direction:column;gap:4px;padding:9px;cursor:pointer;background:none;border:none;border-radius:12px;}
        .ham-btn span{display:block;width:20px;height:2px;border-radius:2px;}
        @media(min-width:768px){.ham-btn{display:none;}}

        /* Desktop nav — hidden on mobile */
        .desk-nav{display:none;}
        @media(min-width:768px){.desk-nav{display:flex;gap:6px;}}
        .profile-btn-desk{display:none;}
        @media(min-width:768px){.profile-btn-desk{display:block;}}

        /* Mobile profile avatar — hidden on desktop */
        .mob-profile-btn{display:flex;align-items:center;justify-content:center;}
        @media(min-width:768px){.mob-profile-btn{display:none;}}
      `}</style>

      <div className="app-shell" style={{ background: ts.bg, fontFamily: ts.font, "--ph": ts.ph } as React.CSSProperties}>

        {/* ── DECO ── */}
        {isEva && <>
          <div style={{ position: "fixed", borderRadius: "50%", border: "1px solid rgba(100,116,139,.08)", pointerEvents: "none", top: "50%", left: "50%", width: "600px", height: "600px", animation: "er 24s linear infinite" }} />
          <div style={{ position: "fixed", borderRadius: "50%", border: "1px dashed rgba(100,116,139,.05)", pointerEvents: "none", top: "50%", left: "50%", width: "420px", height: "420px", animation: "er 17s linear infinite reverse" }} />
          <div style={{ position: "fixed", left: 0, right: 0, height: "1px", pointerEvents: "none", background: "linear-gradient(90deg,transparent,rgba(100,116,139,.22),transparent)", animation: "esw 5s ease-in-out infinite" }} />
          <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(100,116,139,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(100,116,139,.03) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
        </>}
        {theme === "squish" && <>
          <div style={{ position: "fixed", width: "220px", height: "220px", borderRadius: "50%", background: "radial-gradient(circle,rgba(251,191,36,.1) 0%,transparent 70%)", top: "-40px", right: "-40px", pointerEvents: "none", animation: "sq1 7s ease-in-out infinite" }} />
          <div style={{ position: "fixed", width: "160px", height: "160px", borderRadius: "50%", background: "radial-gradient(circle,rgba(245,158,11,.07) 0%,transparent 70%)", bottom: "100px", left: "-20px", pointerEvents: "none", animation: "sq2 9s ease-in-out infinite" }} />
        </>}
        {isSpark && <>
          <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle,rgba(236,72,153,.06) 1.5px,transparent 1.5px)", backgroundSize: "30px 30px", animation: "sd 25s linear infinite" }} />
          {["✦", "★", "💖", "✨", "🌸"].map((s, i) => <div key={i} style={{ position: "fixed", pointerEvents: "none", animation: `sf 4s ease-in-out infinite`, animationDelay: `${i * .65}s`, opacity: .22, fontSize: "15px", color: i % 2 ? "#EC4899" : "#F472B6", left: i < 3 ? `${8 + i * 22}%` : undefined, right: i >= 3 ? `${5 + (i - 3) * 22}%` : undefined, top: `${4 + (i % 3) * 7}%` }}>{s}</div>)}
        </>}
        {isTransitioning && <div style={{ position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none", background: `rgba(${accentRgb},.12)`, animation: "fl .4s ease" }} />}

        <AppDownloadBanner />
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />

        {/* MODALS */}
        {showPomodoro && <PomodoroTimer accent={accent} accentRgb={accentRgb} theme={theme} companionName={activeCompanion.id} onClose={() => setShowPomodoro(false)} onMessage={msg => handleSendMessage(msg, false)} />}
        {showShareCard && <ShareCard name={profile.full_name || "Agent"} level={level} xp={xp} streak={streak} companionName={activeCompanion.name} accent={accent} accentRgb={accentRgb} theme={theme} onClose={() => setShowShareCard(false)} />}

        {/* MOBILE DRAWER */}
        <MobileDrawer
          isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}
          theme={theme} accent={accent} accentRgb={accentRgb}
          companionName={activeCompanion.id} userName={profile.full_name || ""} userEmail={session?.user?.email || ""}
          avatarUrl={profile.avatar_url} level={level} xp={xp} streak={streak}
          tasks={tasks} messages={messages} pokeCount={pokeCount} xpPct={xpPct}
          notifStatus={notifStatus} onRequestNotif={requestPermission}
          onGoals={() => setIsTaskOpen(true)} onHistory={() => setIsHistoryOpen(true)}
          onWipe={() => { if (confirm("Clear chat?")) setMessages([{ role: "assistant", content: activeCompanion.greeting(profile.full_name || "Agent"), timestamp: Date.now() }]); }}
          onSignOut={() => supabase.auth.signOut()}
          onAvatarClick={() => fileInputRef.current?.click()}
          onEditName={() => setEditingName(true)}
          onPomodoro={() => setShowPomodoro(true)} onShareCard={() => setShowShareCard(true)}
          onToggleSound={toggleSound} soundOn={soundOn} quotaRemaining={quotaRemaining}
          companions={COMPANIONS as any} activeCompanionId={activeCompanion.id}
          onSwitchCompanion={c => switchCompanion(c as any)}
          editingName={editingName} nameInput={nameInput}
          onNameInput={setNameInput} onSaveName={saveName}
          avatarUploading={avatarUploading} soundThemeDesc={activeCompanion.soundThemeDesc}
        />

        {/* LEVEL UP */}
        {showLevelUp && (
          <div style={{ position: "fixed", top: "50%", left: "50%", zIndex: 9999, pointerEvents: "none", animation: "lu 3.5s ease forwards" }}>
            <div style={{ padding: "16px 32px", borderRadius: isEva ? "8px" : "20px", background: isEva ? "rgba(0,0,0,.92)" : "rgba(255,255,255,.96)", border: `2px solid ${accent}`, boxShadow: `0 0 40px rgba(${accentRgb},.5)`, textAlign: "center" }}>
              <div style={{ fontSize: "28px", marginBottom: "6px" }}>🏆</div>
              <div style={{ ...ts.ptitle, color: accent }}>{isSpark ? `LEVEL ${levelUpNum} UNLOCKED!! 🎉` : isEva ? `LEVEL_${levelUpNum}_REACHED` : `Level ${levelUpNum}! ✨`}</div>
            </div>
          </div>
        )}

        {/* MOOD BANNER */}
        {showMoodBanner && (
          <div style={{ position: "fixed", top: "60px", left: "50%", zIndex: 500, pointerEvents: "none", animation: "mbin .4s ease,mbout .4s ease 3.8s forwards", maxWidth: "88vw", whiteSpace: "nowrap" }}>
            <div style={{ padding: "9px 18px", borderRadius: isEva ? "4px" : "18px", background: isEva ? "rgba(0,0,0,.88)" : "rgba(255,255,255,.93)", border: `1.5px solid rgba(${accentRgb},.5)`, display: "flex", alignItems: "center", gap: "8px", ...ts.stxt }}>
              <span style={{ fontSize: "16px" }}>{currentMood === "stressed" ? "💛" : currentMood === "happy" ? "🎉" : "🎯"}</span>
              {moodMessage}
            </div>
          </div>
        )}

        {/* ── DESKTOP PANELS ── */}
        {/* History */}
        <div style={panelStyle(isHistoryOpen, "left")}>
          <div style={{ padding: "18px 16px", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexShrink: 0 }}>
              <div style={ts.ptitle}>{isEva ? "SYNC_LOGS" : isSpark ? "💬 History!!" : "Chat History"}</div>
              <button onClick={() => setIsHistoryOpen(false)} style={{ ...ts.panelBtn, padding: "5px 9px", cursor: "pointer" }}>✕</button>
            </div>
            <div className="nsc" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "7px" }}>
              {messages.map((m, i) => (
                <div key={i} style={{ ...(m.isBriefing ? ts.briefCard : m.role === "user" ? ts.muser : ts.mbot), padding: "8px 11px" }}>
                  {m.isBriefing && <div style={{ ...ts.stxt, marginBottom: "3px" }}>☀️ DAILY BRIEF</div>}
                  <div style={{ fontFamily: "monospace", fontSize: "8px", opacity: .3, marginBottom: "2px", textTransform: "uppercase" }}>{m.role === "user" ? "▶ You" : `◆ ${activeCompanion.name}`}</div>
                  <div style={{ fontSize: "12px", lineHeight: 1.4, opacity: .8, color: ts.fg }}>{m.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Goals */}
        <div style={{ ...panelStyle(isTaskOpen, "left"), zIndex: 120 }}>
          <div style={{ padding: "18px 16px", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexShrink: 0 }}>
              <div style={ts.ptitle}>{isEva ? "OBJECTIVES" : isSpark ? "🎯 Goals!!" : "My Goals 🎯"}</div>
              <button onClick={() => setIsTaskOpen(false)} style={{ ...ts.panelBtn, padding: "5px 9px", cursor: "pointer" }}>✕</button>
            </div>
            <div className="nsc" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "7px" }}>
              {tasks.length === 0
                ? <div style={{ textAlign: "center", padding: "40px 0", opacity: .25, fontFamily: "monospace", fontSize: "12px" }}>No objectives yet</div>
                : tasks.map(t => (
                  <div key={t.id} style={{ ...ts.mbot, padding: "10px 12px", cursor: "pointer" }} onClick={() => handleToggleTask(t)}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "14px", height: "14px", borderRadius: "50%", border: `2px solid rgba(${accentRgb},.5)`, background: t.completed ? accent : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: "black", fontWeight: "bold" }}>{t.completed ? "✓" : ""}</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, opacity: .8, textDecoration: t.completed ? "line-through" : "none", color: ts.fg }}>{t.text}</div>
                    </div>
                  </div>
                ))}
            </div>
            <div style={{ marginTop: "10px", display: "flex", gap: "8px", alignItems: "center", borderTop: `1px solid rgba(${accentRgb},.15)`, paddingTop: "10px", flexShrink: 0 }}>
              <input style={{ background: "transparent", border: "none", borderBottom: `1.5px solid rgba(${accentRgb},.4)`, outline: "none", flex: 1, padding: "4px 6px", minWidth: 0, fontFamily: ts.font, fontSize: "13px", color: isEva ? "white" : "#1F2937" }} placeholder="Add a goal..." value={newTaskText} onChange={e => setNewTaskText(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddTask()} />
              <button style={{ ...ts.sbtn, padding: "6px 12px", cursor: "pointer", borderRadius: isEva ? "4px" : "14px", fontSize: "12px" }} onClick={handleAddTask}>+</button>
            </div>
          </div>
        </div>
        {/* Desktop Profile */}
        <div style={panelStyle(isProfileOpen, "right")}>
          <div className="nsc" style={{ padding: "18px 16px", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", flexShrink: 0 }}>
              <div style={ts.ptitle}>{isEva ? "AGENT_STATS" : isSpark ? "✨ Stats!!" : "My Stats 👤"}</div>
              <button onClick={() => setIsProfileOpen(false)} style={{ ...ts.panelBtn, padding: "5px 9px", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ position: "relative", cursor: "pointer" }} onClick={() => fileInputRef.current?.click()}>
              <div style={{ width: "68px", height: "68px", borderRadius: "50%", overflow: "hidden", background: `rgba(${accentRgb},.1)`, border: `2px solid rgba(${accentRgb},.5)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {avatarUploading ? <div style={{ width: "20px", height: "20px", border: `2px solid rgba(${accentRgb},.3)`, borderTop: `2px solid ${accent}`, borderRadius: "50%", animation: "spin .8s linear infinite" }} /> : profile.avatar_url ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "28px" }}>👤</span>}
              </div>
              <div style={{ ...ts.dot, position: "absolute", bottom: 1, right: 1, width: "8px", height: "8px", borderRadius: "50%" }} />
            </div>
            {editingName ? (
              <div style={{ width: "100%", display: "flex", gap: "6px", alignItems: "center" }}>
                <input style={{ background: "transparent", border: "none", borderBottom: `2px solid ${accent}`, outline: "none", fontWeight: 700, fontSize: "16px", textAlign: "center", width: "100%", padding: "2px 4px", color: isEva ? "white" : "#1F2937", fontFamily: ts.font }} value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }} autoFocus />
                <button style={{ ...ts.sbtn, padding: "5px 9px", cursor: "pointer", borderRadius: "8px", fontSize: "11px" }} onClick={saveName}>✓</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }} onClick={() => setEditingName(true)}>
                <div style={{ ...ts.ptitle, color: accent }}>{profile.full_name || "AGENT"}</div>
                <span style={{ fontSize: "11px", opacity: .4 }}>✏️</span>
              </div>
            )}
            <div style={{ fontFamily: "monospace", fontSize: "9px", opacity: .38, textAlign: "center", wordBreak: "break-all" }}>{session?.user?.email}</div>
            <div style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontFamily: "monospace", fontSize: "10px", color: accent }}>LVL {level}</span>
                <span style={{ fontFamily: "monospace", fontSize: "9px", opacity: .35 }}>{xp}/{nxtXP} XP</span>
              </div>
              <div style={{ background: ts.xpbg, borderRadius: isEva ? "2px" : "10px", height: isEva ? "3px" : "5px", width: "100%" }}>
                <div style={{ background: ts.xpfg, width: `${xpPct}%`, height: "100%", borderRadius: "inherit", transition: "width .8s" }} />
              </div>
            </div>
            <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {[{ l: "LVL", v: level }, { l: "STREAK", v: `${streak}🔥` }, { l: "TASKS", v: `${doneTasks}/${tasks.length}` }, { l: "XP", v: xp }].map((s, i) => (
                <div key={i} style={{ ...ts.chip, padding: "5px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={ts.chipL}>{s.l}</span><span style={ts.chipV}>{s.v}</span>
                </div>
              ))}
            </div>
            {COMPANIONS.map(c => { const ia = c.id === activeCompanion.id; return (
              <button key={c.id} onClick={() => switchCompanion(c)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", width: "100%", borderRadius: "10px", border: `1.5px solid ${ia ? c.accent : `rgba(${accentRgb},.12)`}`, background: ia ? `rgba(${c.accentRgb},.1)` : "transparent", cursor: "pointer", marginBottom: "4px" }}>
                <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: c.bgColor, flexShrink: 0 }} />
                <div style={{ fontFamily: ts.font, fontSize: "13px", fontWeight: 600, color: c.accent }}>{c.name}</div>
                {ia && <div style={{ marginLeft: "auto", width: "7px", height: "7px", borderRadius: "50%", background: c.accent }} />}
              </button>
            ); })}
            <div style={{ display: "flex", gap: "6px", width: "100%" }}>
              <button onClick={() => { setIsProfileOpen(false); setShowPomodoro(true); }} style={{ ...ts.panelBtn, flex: 1, padding: "8px", cursor: "pointer", textAlign: "center", fontSize: "11px" }}>🍅 Pomodoro</button>
              <button onClick={() => { setIsProfileOpen(false); setShowShareCard(true); }} style={{ ...ts.panelBtn, flex: 1, padding: "8px", cursor: "pointer", textAlign: "center", fontSize: "11px" }}>📊 Share</button>
            </div>
            <button onClick={toggleSound} style={{ ...ts.panelBtn, width: "100%", padding: "8px", cursor: "pointer", textAlign: "center", background: soundOn ? `rgba(${accentRgb},.12)` : undefined, borderColor: soundOn ? accent : undefined }}>
              {soundOn ? "🔇 Sound Off" : `🎵 ${activeCompanion.soundThemeDesc}`}
            </button>
            {notifStatus !== "granted" && <button onClick={requestPermission} style={{ ...ts.sbtn, width: "100%", padding: "8px", cursor: "pointer", textAlign: "center", fontSize: "11px" }}>🔔 Enable Notifications</button>}
            {notifStatus === "granted" && <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#86EFAC", textAlign: "center" }}>✅ Notifications enabled</div>}
            {quotaRemaining !== null && <div style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", background: quotaRemaining < 1500 ? "rgba(239,68,68,.08)" : "rgba(34,197,94,.06)", border: `1px solid ${quotaRemaining < 1500 ? "rgba(239,68,68,.3)" : "rgba(34,197,94,.25)"}` }}>
              <div style={{ fontFamily: "monospace", fontSize: "8px", opacity: .35, textTransform: "uppercase", marginBottom: "2px" }}>Voice Quota</div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "11px", color: quotaRemaining < 1500 ? "#FCA5A5" : "#86EFAC" }}>{quotaRemaining.toLocaleString()} chars</div>
            </div>}
            <button onClick={() => supabase.auth.signOut()} style={{ ...ts.panelBtnR, padding: "9px", cursor: "pointer", width: "100%", textAlign: "center", marginTop: "4px" }}>⏻ Sign Out</button>
          </div>
        </div>

        {(isTaskOpen || isHistoryOpen || isProfileOpen) && <div onClick={() => { setIsTaskOpen(false); setIsHistoryOpen(false); setIsProfileOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,.3)", backdropFilter: "blur(4px)" }} />}

        {/* ── STATUS BAR ── */}
        <div style={{ ...ts.sbar, flexShrink: 0, padding: "7px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
            <svg width="15" height="15" viewBox="0 0 100 100" fill="none" style={{ flexShrink: 0 }}>
              <polygon points="50,4 93,27.5 93,72.5 50,96 7,72.5 7,27.5" stroke={accent} strokeWidth="3" fill="none" opacity="0.9" />
              <circle cx="50" cy="50" r="13" stroke={accent} strokeWidth="2.5" fill="none" />
              <circle cx="50" cy="50" r="5.5" fill={accent} />
            </svg>
            <span style={{ ...ts.stxt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isEva ? `AEGIS_v2.0 — ${activeCompanion.status}` : isSpark ? `✨ ${activeCompanion.status}` : `Aegis — ${activeCompanion.status}`}
            </span>
          </div>
          {isMounted && <span style={{ ...ts.stxt, opacity: .6, flexShrink: 0 }}>LVL {level} · {xp}XP · {streak}🔥</span>}
        </div>

        {/* ── MAIN AREA ── */}
        <div className="main-area">

          {/* CHAT COLUMN */}
          <div className="chat-col">
            {/* HEADER */}
            <div className="hdr">
              {/* Mobile hamburger */}
              <button className="ham-btn" onClick={() => setDrawerOpen(true)} style={{ background: `rgba(${accentRgb},.08)`, border: `1px solid rgba(${accentRgb},.2)`, borderRadius: "12px" }}>
                <span style={{ background: accent }} /><span style={{ background: accent }} /><span style={{ background: accent }} />
              </button>
              {/* Desktop nav */}
              <div className="desk-nav">
                <button onClick={() => { playUI("click", theme); setIsTaskOpen(true); }} style={{ ...ts.panelBtn, padding: "7px 12px", cursor: "pointer" }}>{isEva ? "GOALS" : "🎯 Goals"}</button>
                <button onClick={() => { playUI("click", theme); setIsHistoryOpen(true); }} style={{ ...ts.panelBtn, padding: "7px 12px", cursor: "pointer" }}>{isEva ? "HISTORY" : "💬 History"}</button>
                <button onClick={() => { if (confirm("Clear chat?")) setMessages([{ role: "assistant", content: activeCompanion.greeting(profile.full_name || "Agent"), timestamp: Date.now() }]); }} style={{ ...ts.panelBtnR, padding: "7px 12px", cursor: "pointer" }}>{isEva ? "WIPE" : "Wipe"}</button>
              </div>
              {/* Companion selector */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: "6px", padding: "6px 12px", borderRadius: "40px", ...ts.compBox }}>
                  {COMPANIONS.map(c => { const ia = c.id === activeCompanion.id; return (
                    <button key={c.id} onClick={() => switchCompanion(c)} title={c.name} style={{ display: "flex", alignItems: "center", gap: "5px", padding: ia ? "5px 10px" : "5px 6px", borderRadius: "30px", border: "none", background: ia ? c.bgColor : "transparent", cursor: "pointer", transition: "all .3s", boxShadow: ia ? `0 0 12px rgba(${c.accentRgb},.6)` : undefined }}>
                      <div style={{ width: ia ? "8px" : "20px", height: ia ? "8px" : "20px", borderRadius: "50%", background: c.bgColor, flexShrink: 0, opacity: ia ? 0 : .35, transition: "all .3s" }} />
                      {ia && <span style={{ fontFamily: ts.font, fontSize: isEva ? "9px" : "12px", fontWeight: 700, color: "#000", whiteSpace: "nowrap" }}>{c.name}</span>}
                    </button>
                  ); })}
                </div>
                <div style={{ ...ts.stxt, fontSize: "8px", color: `rgba(${accentRgb},.6)`, textTransform: "uppercase", letterSpacing: ".1em" }}>{activeCompanion.label}</div>
              </div>
              {/* Desktop profile */}
              <button className="profile-btn-desk" onClick={() => { playUI("click", theme); setIsProfileOpen(true); }} style={{ ...ts.panelBtn, padding: "7px 12px", cursor: "pointer" }}>{isEva ? "PROFILE" : "👤 Profile"}</button>
              {/* Mobile profile avatar */}
              <button className="mob-profile-btn" onClick={() => setDrawerOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", overflow: "hidden", background: `rgba(${accentRgb},.15)`, border: `2px solid rgba(${accentRgb},.4)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "18px" }}>👤</span>}
                </div>
              </button>
            </div>

            {/* DAILY BRIEF — distinct style */}
            {briefingMsg && (
              <div className="briefing-wrap">
                <div style={{ ...ts.briefCard, padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "14px" }}>{isEva ? "◆" : isSpark ? "🌸" : "☀️"}</span>
                    <div style={{ ...ts.ptitle, fontSize: isEva ? "9px" : "12px", color: accent, textTransform: isEva ? "uppercase" : "none", letterSpacing: isEva ? ".15em" : "0" }}>
                      {isEva ? "DAILY_BRIEFING" : isSpark ? "DAILY BRIEF!! ✨" : "Daily Brief"}
                    </div>
                    <div style={{ ...ts.dot, width: "5px", height: "5px", borderRadius: "50%", marginLeft: "auto", animation: "pd 2s infinite" }} />
                  </div>
                  <div style={{ ...ts.briefTxt, fontSize: "13px" }}>{briefingMsg.content}</div>
                </div>
              </div>
            )}

            {/* LAST CHAT MESSAGE */}
            {chatMessages.length > 0 && (
              <div className="chat-wrap">
                <div style={{ ...ts.card, padding: isEva ? "12px 16px" : "14px 18px", animation: "mi .35s ease" }}>
                  {isEva && (
                    <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "8px", color: `rgba(${accentRgb},.5)`, marginBottom: "7px", display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: ".12em" }}>
                      <span>◆ EVA_OUTPUT</span>
                      {isLoading && <span style={{ display: "inline-flex", gap: "3px", color: accent }}>{[0, 1, 2].map(i => <span key={i} style={{ width: "3px", height: "3px", borderRadius: "50%", background: "currentColor", display: "inline-block", animation: `bd 1.2s infinite`, animationDelay: `${i * .2}s` }} />)}</span>}
                    </div>
                  )}
                  <div style={ts.txt}>
                    {isLoading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: isEva ? "flex-start" : "center", color: `rgba(${accentRgb},.7)` }}>
                        <span style={{ fontSize: "12px" }}>{isSpark ? "Sparkling... ✨" : isEva ? "PROCESSING..." : "Thinking..."}</span>
                        <span style={{ display: "inline-flex", gap: "3px" }}>{[0, 1, 2].map(i => <span key={i} style={{ width: "5px", height: "5px", borderRadius: "50%", background: accent, display: "inline-block", animation: `bd 1.2s infinite`, animationDelay: `${i * .2}s` }} />)}</span>
                      </div>
                    ) : (
                      <>
                        <div style={{ maxHeight: expandChat ? "none" : "4.8em", overflow: "hidden", maskImage: !expandChat && lastChatMsg.length > 120 ? "linear-gradient(to bottom,black 55%,transparent 100%)" : "none", WebkitMaskImage: !expandChat && lastChatMsg.length > 120 ? "linear-gradient(to bottom,black 55%,transparent 100%)" : "none" }}>
                          <ReactMarkdown>{lastChatMsg}</ReactMarkdown>
                        </div>
                        {lastChatMsg.length > 120 && (
                          <button onClick={() => setExpandChat(e => !e)} style={{ background: "none", border: "none", cursor: "pointer", color: accent, fontFamily: ts.font, fontSize: "12px", padding: "4px 0 0", opacity: .7 }}>
                            {expandChat ? "▲ Less" : isSpark ? "▼ See full message!! 📖" : "▼ See full message"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COMPANION COLUMN — takes remaining space on desktop */}
          <div className="companion-col">
            <div className="companion-inner" style={{ position: "relative", animation: companionAnim === "bounce" ? "bc .6s cubic-bezier(.36,.07,.19,.97)" : companionAnim === "wave" ? "wv .6s ease-in-out" : undefined }}>
              <div style={{ position: "absolute", inset: "-15%", borderRadius: "50%", pointerEvents: "none", background: ts.aura, animation: "ap 3s ease-in-out infinite" }} />
              <Companion3D
                activeColor={activeCompanion.id === "squish" ? "bg-yellow-400" : activeCompanion.id === "eva" ? "bg-slate-500" : "bg-pink-500"}
                isThinking={isLoading} companionId={activeCompanion.id} onPoke={handlePoke} lastPoke={lastPoke}
              />
            </div>
          </div>
        </div>

        {/* ── BOTTOM BAR ── */}
        <div className="bottom-bar">
          <div className="stats-row">
            {[{ l: "LVL", v: level }, { l: "XP", v: xp }, { l: "STREAK", v: `${streak}🔥` }, { l: "TASKS", v: `${doneTasks}/${tasks.length}` }].map((s, i) => (
              <div key={i} style={{ ...ts.chip, padding: "3px 8px", display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
                <span style={ts.chipL}>{s.l}</span><span style={ts.chipV}>{s.v}</span>
              </div>
            ))}
            <button onClick={() => setShowPomodoro(true)} style={{ ...ts.chip, padding: "3px 8px", cursor: "pointer", flexShrink: 0, border: `1px solid rgba(${accentRgb},.22)`, background: `rgba(${accentRgb},.08)`, display: "flex", alignItems: "center" }}>
              <span style={ts.chipL}>🍅</span>
            </button>
            <button onClick={() => setShowShareCard(true)} style={{ ...ts.chip, padding: "3px 8px", cursor: "pointer", flexShrink: 0, border: `1px solid rgba(${accentRgb},.22)`, background: `rgba(${accentRgb},.08)`, display: "flex", alignItems: "center" }}>
              <span style={ts.chipL}>📊</span>
            </button>
          </div>
          <div style={{ maxWidth: "700px", margin: "0 auto", width: "100%" }}>
            <div style={{ background: ts.xpbg, borderRadius: isEva ? "2px" : "10px", height: isEva ? "3px" : "4px" }}>
              <div style={{ background: ts.xpfg, width: `${xpPct}%`, height: "100%", borderRadius: "inherit", transition: "width .8s" }} />
            </div>
          </div>
          <div className="input-row" style={{ ...ts.ibar }}>
            {isEva && <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "9px", color: `rgba(${accentRgb},.4)`, flexShrink: 0 }}>▶</span>}
            <input className="ai input-grow" value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendMessage()}
              style={{ ...ts.txt, textAlign: "left" as const, fontSize: "14px", fontFamily: ts.font, fontWeight: "normal" }}
              placeholder={isEva ? "AWAITING COMMAND..." : isSpark ? "tell me everything!! 💖" : "Ask me anything..."} />
            <button onClick={startListening} style={{ ...ts.mic, borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", cursor: "pointer", flexShrink: 0, ...(isListening ? { borderColor: "#EF4444", background: "rgba(239,68,68,.15)" } : {}) }}>🎤</button>
            <button onClick={() => handleSendMessage()} style={{ ...ts.sbtn, padding: "9px 16px", cursor: "pointer", flexShrink: 0 }}>{isEva ? "GO ▶" : isSpark ? "SEND 💌" : "Send ✦"}</button>
          </div>
          <div style={{ textAlign: "center", ...ts.stxt, fontSize: "8px", opacity: .25 }}>
            🎤 "Hey {activeCompanion.name}" · {isMobile ? "☰ Menu for more" : "🍅 Pomodoro · 📊 Share"}
          </div>
        </div>
      </div>
    </>
  );
}
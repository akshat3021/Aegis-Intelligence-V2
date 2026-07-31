"use client";
import { useState, useEffect, useRef } from "react";

interface Props {
  accent: string;
  accentRgb: string;
  theme: string;
  companionName: string;
  onClose: () => void;
  onMessage: (msg: string) => void;
}

const PHASES = [
  { label: "FOCUS", duration: 25 * 60, color: "#F59E0B" },
  { label: "BREAK", duration: 5 * 60,  color: "#10B981" },
];

const MOTIVATIONS: Record<string, string[]> = {
  squish: [
    "You're doing amazing! Keep going! 💛",
    "Halfway there! Squish is proud of you! 🌟",
    "Almost done! You're crushing it! 🎯",
    "Break time! You deserve it! 🥳",
  ],
  spark: [
    "OMG YOU'RE SO FOCUSED RIGHT NOW!! 🔥🔥",
    "HALFWAY!! YOU'RE ABSOLUTELY KILLING IT!! 💥",
    "ALMOST THERE!! SPRINT TO THE FINISH!! 🚀",
    "YESSSS BREAK TIME!! YOU LEGEND!! 🎉🎊",
  ],
  eva: [
    "Focus parameters optimal. Maintain concentration.", 
    "50% completion. Performance nominal.",
    "Final stretch. Efficiency at maximum.",
    "Session complete. Rest protocols initiated.",
  ],
};

export default function PomodoroTimer({ accent, accentRgb, theme, companionName, onClose, onMessage }: Props) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(PHASES[0].duration);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef<any>(null);
  const motivIdx = useRef(0);
  const isEva = theme === "eva";
  const isSpark = theme === "spark";

  const phase = PHASES[phaseIdx];
  const pct = ((phase.duration - timeLeft) / phase.duration) * 100;
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");

  // Bug #7 fix: track phaseIdx in a ref so the setTimeout callback inside the
  // interval always reads the CURRENT value, not the stale closure value.
  const phaseIdxRef = useRef(phaseIdx);
  useEffect(() => { phaseIdxRef.current = phaseIdx; }, [phaseIdx]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        // Send motivational messages at key points
        const elapsed = phase.duration - t + 1;
        if (elapsed === Math.floor(phase.duration * 0.5)) {
          const msgs = MOTIVATIONS[companionName] || MOTIVATIONS.squish;
          onMessage(msgs[1]);
        }
        if (elapsed === Math.floor(phase.duration * 0.9)) {
          const msgs = MOTIVATIONS[companionName] || MOTIVATIONS.squish;
          onMessage(msgs[2]);
        }
        if (t <= 1) {
          // Phase complete
          clearInterval(intervalRef.current);
          setRunning(false);
          const msgs = MOTIVATIONS[companionName] || MOTIVATIONS.squish;
          onMessage(msgs[3]);
          if (phaseIdxRef.current === 0) setSessions(s => s + 1);
          setTimeout(() => {
            // Bug #7 fix: use ref to get current phaseIdx instead of stale closure value
            const nextIdx = (phaseIdxRef.current + 1) % PHASES.length;
            setPhaseIdx(nextIdx);
            setTimeLeft(PHASES[nextIdx].duration);
          }, 1500);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, phaseIdx]);

  const toggle = () => {
    if (!running && timeLeft === phase.duration) {
      const msgs = MOTIVATIONS[companionName] || MOTIVATIONS.squish;
      onMessage(msgs[0]);
    }
    setRunning(r => !r);
  };

  const reset = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setTimeLeft(phase.duration);
  };

  const font = isEva ? "'Share Tech Mono',monospace" : isSpark ? "'Bubblegum Sans',cursive" : "'Fredoka',sans-serif";
  const bg   = isEva ? "rgba(0,0,0,.92)" : "rgba(255,255,255,.95)";
  const fg   = isEva ? "white" : "#1F2937";

  // SVG circle progress
  const R = 54;
  const C = 2 * Math.PI * R;
  const offset = C - (pct / 100) * C;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9000,
      display:"flex", alignItems:"center", justifyContent:"center",
      background:"rgba(0,0,0,.6)", backdropFilter:"blur(8px)",
    }}>
      <div style={{
        background: bg,
        borderRadius: isEva ? "12px" : "28px",
        border: `2px solid rgba(${accentRgb},.4)`,
        boxShadow: `0 0 60px rgba(${accentRgb},.2)`,
        padding: "32px",
        width: "min(340px,88vw)",
        display:"flex", flexDirection:"column", alignItems:"center", gap:"20px",
      }}>
        {/* Header */}
        <div style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:font,fontSize:isEva?"11px":"16px",fontWeight:700,color:accent,letterSpacing:isEva?".2em":"0",textTransform:isEva?"uppercase":"none"}}>
            {isEva?"POMODORO_TIMER":isSpark?"🍅 FOCUS TIME!!":"🍅 Pomodoro Timer"}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:"18px",opacity:.5,color:fg}}>✕</button>
        </div>

        {/* Phase label */}
        <div style={{fontFamily:font,fontSize:"11px",color:phase.label==="FOCUS"?accent:"#10B981",letterSpacing:".2em",textTransform:"uppercase",fontWeight:700}}>
          {phase.label === "FOCUS" ? (isSpark?"🔥 FOCUS MODE!!":isEva?"FOCUS_PHASE":"Focus Phase") : (isSpark?"😮‍💨 BREAK TIME!!":isEva?"REST_PHASE":"Break Time")}
        </div>

        {/* Circular timer */}
        <div style={{position:"relative",width:"140px",height:"140px"}}>
          <svg width="140" height="140" style={{transform:"rotate(-90deg)"}}>
            <circle cx="70" cy="70" r={R} fill="none" stroke={`rgba(${accentRgb},.15)`} strokeWidth="8"/>
            <circle cx="70" cy="70" r={R} fill="none" stroke={phase.label==="FOCUS"?accent:"#10B981"}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={offset}
              style={{transition:"stroke-dashoffset .5s ease"}}/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:"32px",fontWeight:700,color:fg,lineHeight:1}}>
              {mins}:{secs}
            </div>
            <div style={{fontFamily:"monospace",fontSize:"10px",opacity:.4,color:fg,marginTop:"2px"}}>
              SESSION {sessions + 1}
            </div>
          </div>
        </div>

        {/* Sessions completed */}
        <div style={{display:"flex",gap:"6px"}}>
          {[0,1,2,3].map(i=>(
            <div key={i} style={{width:"12px",height:"12px",borderRadius:"50%",background:i<sessions?accent:`rgba(${accentRgb},.2)`,transition:"background .3s"}}/>
          ))}
          <div style={{fontFamily:"monospace",fontSize:"9px",opacity:.4,color:fg,marginLeft:"4px",alignSelf:"center"}}>/ 4 SESSIONS</div>
        </div>

        {/* Controls */}
        <div style={{display:"flex",gap:"10px"}}>
          <button onClick={toggle} style={{
            background:accent,color:"#000",border:"none",
            borderRadius: isEva?"4px":"20px",
            padding:"10px 28px",
            fontFamily:font,fontSize:isEva?"10px":"14px",fontWeight:700,
            cursor:"pointer",
            letterSpacing:isEva?".15em":"0",
            textTransform:isEva?"uppercase":"none",
            boxShadow:`0 4px 16px rgba(${accentRgb},.4)`,
          }}>
            {running ? (isSpark?"⏸ PAUSE!!":isEva?"PAUSE":"⏸ Pause") : (isSpark?"▶ START!!":isEva?"INITIATE":"▶ Start")}
          </button>
          <button onClick={reset} style={{
            background:`rgba(${accentRgb},.1)`,color:accent,
            border:`1px solid rgba(${accentRgb},.3)`,
            borderRadius: isEva?"4px":"20px",
            padding:"10px 18px",
            fontFamily:font,fontSize:isEva?"10px":"14px",
            cursor:"pointer",
          }}>
            {isSpark?"↺":isEva?"RST":"↺"}
          </button>
        </div>

        {/* Tip */}
        <div style={{fontFamily:"monospace",fontSize:"9px",opacity:.3,color:fg,textAlign:"center",lineHeight:1.5}}>
          25 min focus · 5 min break · Repeat 4×
        </div>
      </div>
    </div>
  );
}
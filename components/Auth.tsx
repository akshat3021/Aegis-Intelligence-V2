"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";

type Screen = "auth" | "otp" | "done";

export default function Auth() {
  const [screen, setScreen]             = useState<Screen>("auth");
  const [isSignUp, setIsSignUp]         = useState(false);
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [fullName, setFullName]         = useState("");
  const [otp, setOtp]                   = useState(["","","","","",""]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [successMsg, setSuccessMsg]     = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Resend cooldown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ── Get the correct redirect URL (works for both local + Vercel) ──────────
  const getRedirectURL = () => {
    // In production (Vercel), use the actual domain
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      // Remove any hash/path, just use the root
      return origin + "/";
    }
    return "http://localhost:3000/";
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getRedirectURL(),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) setError(error.message);
  };

  // ── Email Auth ────────────────────────────────────────────────────────────
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccessMsg(""); setLoading(true);

    if (isSignUp) {
      // Validate password length
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setLoading(false); return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: getRedirectURL(),
        },
      });

      if (error) {
        // Common errors with friendly messages
        if (error.message.includes("already registered")) {
          setError("This email is already registered. Try signing in instead.");
        } else if (error.message.includes("rate limit")) {
          setError("Too many attempts. Please wait a minute and try again.");
        } else {
          setError(error.message);
        }
      } else {
        setScreen("otp");
        setResendCooldown(60);
        setSuccessMsg(`Verification code sent to ${email}. Check your inbox and spam folder!`);
      }
    } else {
      // Sign in
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setError("Wrong email or password. Please try again.");
        } else if (error.message.includes("Email not confirmed")) {
          setError("Please verify your email first. Check your inbox for the OTP.");
          setScreen("otp");
        } else {
          setError(error.message);
        }
      }
    }
    setLoading(false);
  };

  // ── OTP handling ──────────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const next = [...otp]; next[index] = value; setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowLeft"  && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
    const next = [...otp];
    pasted.split("").forEach((d,i) => { next[i] = d; });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) { setError("Please enter the full 6-digit code."); return; }
    setError(""); setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "signup",
    });

    if (error) {
      setError("Invalid or expired code. Request a new one below.");
      setOtp(["","","","","",""]);
      otpRefs.current[0]?.focus();
    } else {
      setScreen("done");
    }
    setLoading(false);
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(""); setSuccessMsg("");
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      if (error.message.includes("rate limit")) {
        setError("Too many requests. Please wait a few minutes.");
      } else {
        setError(error.message);
      }
    } else {
      setResendCooldown(60);
      setSuccessMsg("New code sent! Check your inbox and spam folder.");
      setOtp(["","","","","",""]);
      otpRefs.current[0]?.focus();
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');

        .auth-root {
          position:fixed;inset:0;z-index:200;
          display:flex;align-items:center;justify-content:center;
          background:#050508;font-family:'Rajdhani',sans-serif;overflow:hidden;
        }
        .auth-root::before {
          content:'';position:absolute;inset:0;pointer-events:none;
          background-image:linear-gradient(rgba(245,158,11,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,.04) 1px,transparent 1px);
          background-size:44px 44px;
        }
        .auth-root::after {
          content:'';position:absolute;inset:0;pointer-events:none;z-index:0;
          background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.07) 2px,rgba(0,0,0,.07) 4px);
        }
        .auth-orb {
          position:absolute;border-radius:50%;pointer-events:none;filter:blur(80px);
          animation:orb-drift 8s ease-in-out infinite;
        }
        .auth-orb-1{width:400px;height:400px;background:rgba(245,158,11,.06);top:-100px;right:-100px}
        .auth-orb-2{width:300px;height:300px;background:rgba(236,72,153,.04);bottom:-80px;left:-80px;animation-delay:-4s}
        @keyframes orb-drift{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,-20px)}}

        .auth-card {
          position:relative;z-index:10;width:min(440px,94vw);
          background:rgba(255,255,255,.03);border:1px solid rgba(245,158,11,.2);
          border-radius:20px;padding:40px 36px;
          box-shadow:0 0 60px rgba(245,158,11,.06),inset 0 1px 0 rgba(245,158,11,.08);
          backdrop-filter:blur(20px);animation:card-in .5s cubic-bezier(.34,1.56,.64,1);
        }
        @keyframes card-in{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:none}}
        .auth-card::before{content:'';position:absolute;top:-1px;left:-1px;width:16px;height:16px;border-color:#F59E0B;border-style:solid;border-width:2px 0 0 2px;border-radius:2px 0 0 0}
        .auth-card::after {content:'';position:absolute;bottom:-1px;right:-1px;width:16px;height:16px;border-color:#F59E0B;border-style:solid;border-width:0 2px 2px 0;border-radius:0 0 2px 0}

        /* Logo in header */
        .auth-logo-row {
          display:flex;align-items:center;gap:10px;margin-bottom:6px;
        }
        .auth-logo-label {
          font-family:'Share Tech Mono',monospace;font-size:10px;
          letter-spacing:.3em;color:rgba(245,158,11,.7);text-transform:uppercase;
        }
        .auth-logo-dot {
          width:6px;height:6px;border-radius:50%;background:#F59E0B;
          box-shadow:0 0 8px rgba(245,158,11,.9);animation:blink 2s infinite;
        }
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}

        .auth-title {
          font-family:'Rajdhani',sans-serif;font-size:28px;font-weight:700;
          color:white;letter-spacing:.02em;margin-bottom:28px;line-height:1.2;
        }
        .auth-title span{color:#F59E0B}

        .auth-input {
          width:100%;padding:13px 16px;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);
          border-radius:8px;color:white;font-family:'Rajdhani',sans-serif;
          font-size:15px;font-weight:500;outline:none;transition:all .2s;
        }
        .auth-input::placeholder{color:rgba(255,255,255,.2)}
        .auth-input:focus{border-color:rgba(245,158,11,.5);box-shadow:0 0 0 3px rgba(245,158,11,.08);background:rgba(255,255,255,.06)}

        .auth-btn-primary {
          width:100%;padding:14px;background:#F59E0B;color:#000;border:none;
          border-radius:8px;font-family:'Share Tech Mono',monospace;font-size:12px;
          font-weight:700;letter-spacing:.2em;text-transform:uppercase;
          cursor:pointer;transition:all .2s;
          clip-path:polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%);
        }
        .auth-btn-primary:hover{filter:brightness(1.1);box-shadow:0 0 24px rgba(245,158,11,.4)}
        .auth-btn-primary:disabled{opacity:.5;cursor:not-allowed}

        .auth-btn-google {
          width:100%;padding:13px;background:rgba(255,255,255,.05);
          border:1px solid rgba(255,255,255,.12);border-radius:8px;
          color:rgba(255,255,255,.8);font-family:'Rajdhani',sans-serif;
          font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;
          display:flex;align-items:center;justify-content:center;gap:10px;
        }
        .auth-btn-google:hover{border-color:rgba(255,255,255,.25);background:rgba(255,255,255,.08)}

        .auth-divider{display:flex;align-items:center;gap:12px;margin:20px 0}
        .auth-divider-line{flex:1;height:1px;background:rgba(255,255,255,.07)}
        .auth-divider-text{font-family:'Share Tech Mono',monospace;font-size:9px;color:rgba(255,255,255,.2);letter-spacing:.2em}

        .auth-error {
          background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);
          border-radius:6px;padding:10px 14px;font-family:'Share Tech Mono',monospace;
          font-size:10px;color:#FCA5A5;letter-spacing:.05em;
          display:flex;align-items:flex-start;gap:8px;
        }
        .auth-success {
          background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);
          border-radius:6px;padding:10px 14px;font-family:'Share Tech Mono',monospace;
          font-size:10px;color:#86EFAC;letter-spacing:.05em;
          display:flex;align-items:flex-start;gap:8px;
        }

        .auth-switch {
          font-family:'Share Tech Mono',monospace;font-size:10px;
          color:rgba(255,255,255,.25);letter-spacing:.1em;background:none;
          border:none;cursor:pointer;transition:color .2s;text-align:center;
          width:100%;margin-top:20px;text-transform:uppercase;
        }
        .auth-switch:hover{color:#F59E0B}
        .auth-switch span{color:rgba(245,158,11,.7)}

        .otp-grid{display:flex;gap:10px;justify-content:center;margin:24px 0}
        .otp-box {
          width:52px;height:60px;background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.12);border-radius:8px;
          font-family:'Share Tech Mono',monospace;font-size:24px;font-weight:700;
          color:#F59E0B;text-align:center;outline:none;transition:all .2s;
          caret-color:#F59E0B;
        }
        .otp-box:focus{border-color:rgba(245,158,11,.6);box-shadow:0 0 0 3px rgba(245,158,11,.1);background:rgba(245,158,11,.04)}
        .otp-box.filled{border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.06)}

        .resend-btn {
          background:none;border:none;cursor:pointer;font-family:'Share Tech Mono',monospace;
          font-size:10px;letter-spacing:.1em;text-transform:uppercase;margin-top:16px;
          display:block;width:100%;text-align:center;transition:color .2s;
        }
        .resend-btn:not(:disabled){color:rgba(245,158,11,.6)}
        .resend-btn:not(:disabled):hover{color:#F59E0B}
        .resend-btn:disabled{color:rgba(255,255,255,.2);cursor:default}

        .done-icon {
          width:72px;height:72px;border-radius:50%;margin:0 auto 20px;
          background:rgba(245,158,11,.1);border:2px solid rgba(245,158,11,.4);
          display:flex;align-items:center;justify-content:center;font-size:32px;
          box-shadow:0 0 30px rgba(245,158,11,.2);
          animation:done-pop .5s cubic-bezier(.34,1.56,.64,1);
        }
        @keyframes done-pop{from{transform:scale(0)}to{transform:scale(1)}}
        .form-space{display:flex;flex-direction:column;gap:12px}
        .scr{animation:scrin .35s cubic-bezier(.23,1,.32,1)}
        @keyframes scrin{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}

        /* Hint text */
        .auth-hint {
          font-family:'Share Tech Mono',monospace;font-size:9px;
          color:rgba(255,255,255,.2);letter-spacing:.08em;
          margin-top:6px;text-align:center;
        }
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="auth-root">
        <div className="auth-orb auth-orb-1"/>
        <div className="auth-orb auth-orb-2"/>

        <div className="auth-card">

          {/* Logo */}
          <div className="auth-logo-row">
            <svg width="22" height="22" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="50,4 93,27.5 93,72.5 50,96 7,72.5 7,27.5" stroke="#F59E0B" strokeWidth="3" fill="none" opacity="0.9"/>
              <circle cx="50" cy="50" r="14" stroke="#F59E0B" strokeWidth="2.5" fill="none"/>
              <circle cx="50" cy="50" r="6" fill="#F59E0B"/>
              <circle cx="50" cy="50" r="3" fill="white" opacity="0.8"/>
            </svg>
            <div className="auth-logo-label">AEGIS_INTELLIGENCE v2.0</div>
            <div className="auth-logo-dot"/>
          </div>

          {/* ── SCREEN 1: AUTH FORM ── */}
          {screen === "auth" && (
            <div className="scr">
              <div className="auth-title">
                {isSignUp ? <>Create your<br/><span>Agent Profile</span></> : <>Welcome<br/><span>Back, Agent</span></>}
              </div>

              <button onClick={handleGoogle} className="auth-btn-google">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style={{width:18,height:18}} alt="G"/>
                Continue with Google
              </button>

              <div className="auth-divider">
                <div className="auth-divider-line"/>
                <span className="auth-divider-text">OR</span>
                <div className="auth-divider-line"/>
              </div>

              <form onSubmit={handleEmailAuth} className="form-space">
                {isSignUp && (
                  <input className="auth-input" type="text" placeholder="Full Name"
                    value={fullName} onChange={e=>setFullName(e.target.value)} required autoComplete="name"/>
                )}
                <input className="auth-input" type="email" placeholder="Email Address"
                  value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/>
                <input className="auth-input" type="password" placeholder="Password (min 6 characters)"
                  value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}
                  autoComplete={isSignUp?"new-password":"current-password"}/>

                {error   && <div className="auth-error"><span>⚠</span> {error}</div>}
                {successMsg && <div className="auth-success"><span>✓</span> {successMsg}</div>}

                <button type="submit" className="auth-btn-primary" disabled={loading}>
                  {loading ? "PROCESSING..." : isSignUp ? "CREATE ACCOUNT →" : "SIGN IN →"}
                </button>

                {isSignUp && (
                  <div className="auth-hint">
                    A 6-digit code will be sent to your email. Check spam if it doesn't arrive within 2 minutes.
                  </div>
                )}
              </form>

              <button className="auth-switch" onClick={()=>{setIsSignUp(!isSignUp);setError("");setSuccessMsg("");}}>
                {isSignUp ? <>Already have an account? <span>Sign In</span></> : <>New here? <span>Create Account</span></>}
              </button>
            </div>
          )}

          {/* ── SCREEN 2: OTP ── */}
          {screen === "otp" && (
            <div className="scr">
              <div className="auth-title">Verify your<br/><span>Email</span></div>

              <div style={{fontFamily:"Share Tech Mono,monospace",fontSize:"10px",color:"rgba(255,255,255,.3)",textAlign:"center",letterSpacing:".08em",marginBottom:"4px"}}>
                CODE SENT TO
              </div>
              <div style={{fontFamily:"Rajdhani,sans-serif",fontSize:"15px",fontWeight:600,color:"rgba(245,158,11,.8)",textAlign:"center",marginBottom:"4px"}}>{email}</div>
              <div style={{fontFamily:"Share Tech Mono,monospace",fontSize:"9px",color:"rgba(255,255,255,.2)",textAlign:"center",letterSpacing:".06em",marginBottom:"4px"}}>
                Check inbox AND spam/junk folder
              </div>
              <div style={{fontFamily:"Share Tech Mono,monospace",fontSize:"9px",color:"rgba(255,255,255,.15)",textAlign:"center",marginBottom:"4px"}}>
                Code expires in 10 minutes
              </div>

              {/* OTP Boxes */}
              <div className="otp-grid" onPaste={handleOtpPaste}>
                {otp.map((digit,i)=>(
                  <input key={i} ref={el=>{otpRefs.current[i]=el;}}
                    className={`otp-box ${digit?"filled":""}`}
                    type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={e=>handleOtpChange(i,e.target.value)}
                    onKeyDown={e=>handleOtpKeyDown(i,e)}
                    autoFocus={i===0}/>
                ))}
              </div>

              {error      && <div className="auth-error"   style={{marginBottom:"12px"}}><span>⚠</span> {error}</div>}
              {successMsg && <div className="auth-success" style={{marginBottom:"12px"}}><span>✓</span> {successMsg}</div>}

              <button className="auth-btn-primary" onClick={handleVerifyOtp}
                disabled={loading||otp.join("").length<6}>
                {loading ? "VERIFYING..." : "VERIFY CODE →"}
              </button>

              <button className="resend-btn" onClick={handleResend} disabled={resendCooldown>0}>
                {resendCooldown>0 ? `RESEND IN ${resendCooldown}s` : "RESEND CODE"}
              </button>

              <button className="auth-switch" onClick={()=>{setScreen("auth");setError("");setSuccessMsg("");setOtp(["","","","","",""]);otp.fill("");}}>
                ← <span>Back</span> to sign up
              </button>
            </div>
          )}

          {/* ── SCREEN 3: DONE ── */}
          {screen === "done" && (
            <div className="scr" style={{textAlign:"center",padding:"20px 0"}}>
              <div className="done-icon">✓</div>
              <div className="auth-title" style={{textAlign:"center"}}><span>Account Verified!</span></div>
              <div style={{fontFamily:"Share Tech Mono,monospace",fontSize:"11px",color:"rgba(255,255,255,.35)",letterSpacing:".12em",marginBottom:"28px"}}>
                INITIALIZING YOUR AGENT PROFILE...
              </div>
              <div style={{display:"flex",justifyContent:"center"}}>
                <div style={{width:"40px",height:"40px",border:"2px solid rgba(245,158,11,.2)",borderTop:"2px solid #F59E0B",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
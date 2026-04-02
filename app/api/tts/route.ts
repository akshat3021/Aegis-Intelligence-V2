// app/api/tts/route.ts
//
// DUAL ELEVENLABS KEY SYSTEM
// Automatically switches to the backup key when primary runs low.
//
// Add to your .env:
//   ELEVENLABS_API_KEY_1=sk_xxxxxxxxxxxxxxxx   ← primary account
//   ELEVENLABS_API_KEY_2=sk_yyyyyyyyyyyyyyyy   ← backup account
//
// Each key has 10,000 chars/month free → 20,000 total combined!

import { NextRequest, NextResponse } from "next/server";

const KEY_1 = process.env.ELEVENLABS_API_KEY_1 || process.env.ELEVENLABS_API_KEY || "";
const KEY_2 = process.env.ELEVENLABS_API_KEY_2 || "";

// How many chars remaining before we switch to backup key
const FAILOVER_THRESHOLD = 500;

// ── Get remaining quota for a key ────────────────────────────────────────────
async function getQuota(apiKey: string): Promise<{ used: number; limit: number; remaining: number } | null> {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const used      = data?.character_count  ?? 0;
    const limit     = data?.character_limit  ?? 10000;
    const remaining = limit - used;
    return { used, limit, remaining };
  } catch {
    return null;
  }
}

// ── Call ElevenLabs TTS ───────────────────────────────────────────────────────
async function callElevenLabs(text: string, voiceId: string, apiKey: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("ElevenLabs error:", err);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.error("ElevenLabs fetch failed:", e);
    return null;
  }
}

// ── Main Route ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = await req.json();
    if (!text || !voiceId) {
      return NextResponse.json({ error: "Missing text or voiceId", fallback: true }, { status: 400 });
    }

    const cleanText = text
      .replace(/\[.*?\]/g, "")
      .replace(/[*_#`]/g, "")
      .trim()
      .slice(0, 500);

    if (!KEY_1) {
      console.warn("⚠️  No ElevenLabs API key configured");
      return NextResponse.json({ error: "No API key", fallback: true }, { status: 503 });
    }

    // ── Check primary key quota ───────────────────────────────────────────────
    let activeKey   = KEY_1;
    let keyLabel    = "KEY_1";
    let quota1      = await getQuota(KEY_1);
    let remaining   = quota1?.remaining ?? 9999;

    if (remaining <= FAILOVER_THRESHOLD && KEY_2) {
      // Primary is almost out — switch to backup
      console.log(`🔄 KEY_1 low (${remaining} chars left) — switching to KEY_2`);
      const quota2 = await getQuota(KEY_2);
      if (quota2 && quota2.remaining > FAILOVER_THRESHOLD) {
        activeKey  = KEY_2;
        keyLabel   = "KEY_2";
        remaining  = quota2.remaining;
        quota1     = quota2; // for response header
      } else {
        console.warn("⚠️  Both keys low on quota — using browser TTS fallback");
        return NextResponse.json(
          { error: "Both keys exhausted", fallback: true, remaining: 0 },
          { status: 429 }
        );
      }
    }

    console.log(`🎙️  ElevenLabs TTS → ${keyLabel}, voice: ${voiceId}, ~${remaining} chars remaining`);

    // ── Generate audio ────────────────────────────────────────────────────────
    const audio = await callElevenLabs(cleanText, voiceId, activeKey);

    if (!audio) {
      // If primary call failed, try the other key as emergency fallback
      if (KEY_2 && activeKey === KEY_1) {
        console.log("🔄 KEY_1 call failed — emergency fallback to KEY_2");
        const audio2 = await callElevenLabs(cleanText, voiceId, KEY_2);
        if (audio2) {
          const q2 = await getQuota(KEY_2);
          return new NextResponse(audio2, {
            status: 200,
            headers: {
              "Content-Type": "audio/mpeg",
              "X-EL-Remaining": String(q2?.remaining ?? ""),
              "X-EL-Key": "KEY_2_FALLBACK",
            },
          });
        }
      }
      return NextResponse.json({ error: "TTS generation failed", fallback: true }, { status: 500 });
    }

    // ── Re-fetch updated quota after usage ────────────────────────────────────
    const updatedQuota = await getQuota(activeKey);
    const updatedRemaining = updatedQuota?.remaining ?? remaining - cleanText.length;

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "X-EL-Remaining": String(updatedRemaining),
        "X-EL-Key": keyLabel,
        "X-EL-Limit": String(updatedQuota?.limit ?? 10000),
      },
    });

  } catch (err) {
    console.error("TTS route error:", err);
    return NextResponse.json({ error: "Internal error", fallback: true }, { status: 500 });
  }
}
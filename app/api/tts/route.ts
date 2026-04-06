// app/api/tts/route.ts
//
// !! IMPORTANT — FREE TIER VOICE IDs !!
// ElevenLabs free users CANNOT use Voice Library voices via API.
// Only these 9 built-in "premade" voices work on free tier:
//
//  Rachel  → 21m00Tcm4TlvDq8ikWAM  (warm, clear American female)
//  Domi    → AZnzlk1XvdvUeBnXmlld  (strong, expressive female)
//  Bella   → EXAVITQu4vr4xnSDxMaL  (soft, friendly female)
//  Antoni  → ErXwobaYiN019PkySvjV  (well-rounded male)
//  Elli    → MF3mGyEYCl7XYWbV9V6O  (young, emotive female)
//  Josh    → TxGEqnHWrfWFTfGW9XjX  (deep, young American male)
//  Arnold  → VR6AewLTigWG4xSOukaG  (crisp, mature male)
//  Adam    → pNInz6obpgDQGcFmaJgB  (deep, narrative male)
//  Sam     → yoZ06aMxZJJ28mfd3POQ  (raspy, approachable male)
//
// COMPANION ASSIGNMENTS (free tier):
//  Squish  → Rachel  (warm, friendly — perfect match)
//  Eva     → Adam    (deep, authoritative — robotic feel when slowed)
//  Spark   → Elli    (young, energetic — perfect for hyperdrive mode)

import { NextRequest, NextResponse } from "next/server";

// ── FREE TIER VOICE MAP ───────────────────────────────────────────────────────
// These are the ONLY voices that work on free ElevenLabs accounts
const FREE_VOICES: Record<string, string> = {
  // Premade voice IDs — confirmed free tier compatible
  "rachel":  "21m00Tcm4TlvDq8ikWAM",
  "domi":    "AZnzlk1XvdvUeBnXmlld",
  "bella":   "EXAVITQu4vr4xnSDxMaL",
  "antoni":  "ErXwobaYiN019PkySvjV",
  "elli":    "MF3mGyEYCl7XYWbV9V6O",
  "josh":    "TxGEqnHWrfWFTfGW9XjX",
  "arnold":  "VR6AewLTigWG4xSOukaG",
  "adam":    "pNInz6obpgDQGcFmaJgB",
  "sam":     "yoZ06aMxZJJ28mfd3POQ",
};

// ── COMPANION → VOICE MAPPING ─────────────────────────────────────────────────
// Maps companion ID to the correct free voice ID
const COMPANION_VOICE_MAP: Record<string, string> = {
  squish: FREE_VOICES.rachel,  // Warm, friendly American female
  eva:    FREE_VOICES.adam,    // Deep, authoritative (slowed = robotic)
  spark:  FREE_VOICES.elli,    // Young, energetic female
};

// ── SPEED ADJUSTMENTS ────────────────────────────────────────────────────────
// Adjust via playback rate client-side (not ElevenLabs speed param)
// because ElevenLabs speed param can cause quality issues on free tier

// ── DUAL KEY FAILOVER ────────────────────────────────────────────────────────
const KEY_1 = process.env.ELEVENLABS_API_KEY_1 || process.env.ELEVENLABS_API_KEY || "";
const KEY_2 = process.env.ELEVENLABS_API_KEY_2 || "";
const QUOTA_FAILOVER_THRESHOLD = 500;

async function getQuota(apiKey: string): Promise<number> {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return (data?.character_limit ?? 10000) - (data?.character_count ?? 0);
  } catch {
    return 0;
  }
}

async function callElevenLabs(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<{ buffer: ArrayBuffer | null; error?: string }> {
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2", // fastest + uses fewest credits
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("ElevenLabs error:", err);
      return { buffer: null, error: JSON.stringify(err) };
    }

    const buffer = await res.arrayBuffer();
    return { buffer };
  } catch (e) {
    console.error("ElevenLabs fetch failed:", e);
    return { buffer: null, error: String(e) };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Accept either { voiceId, text } (old format) or { companionId, text } (new format)
    // Always resolve to a free-tier voice ID
    const { text, voiceId: rawVoiceId, companionId } = body;

    if (!text) {
      return NextResponse.json({ error: "No text", fallback: true }, { status: 400 });
    }

    // ── RESOLVE VOICE ID ──────────────────────────────────────────────────────
    // Priority: companionId mapping > rawVoiceId (if it's a known free voice) > fallback
    let resolvedVoiceId: string;

    if (companionId && COMPANION_VOICE_MAP[companionId]) {
      // Best path: use companion-specific free voice
      resolvedVoiceId = COMPANION_VOICE_MAP[companionId];
    } else if (rawVoiceId && Object.values(FREE_VOICES).includes(rawVoiceId)) {
      // rawVoiceId is already a valid free voice
      resolvedVoiceId = rawVoiceId;
    } else {
      // Fallback to Rachel (most natural sounding free voice)
      resolvedVoiceId = FREE_VOICES.rachel;
      if (rawVoiceId) {
        console.warn(`⚠️  Voice ID '${rawVoiceId}' is a library voice (requires paid plan). Using Rachel instead.`);
      }
    }

    // Clean text
    const cleanText = text
      .replace(/\[.*?\]/g, "")
      .replace(/[*_#`]/g, "")
      .trim()
      .slice(0, 500);

    if (!KEY_1) {
      console.warn("⚠️  No ElevenLabs API key configured");
      return NextResponse.json({ error: "No API key", fallback: true }, { status: 503 });
    }

    // ── QUOTA CHECK & FAILOVER ────────────────────────────────────────────────
    let activeKey = KEY_1;
    let keyLabel = "KEY_1";
    const quota1 = await getQuota(KEY_1);

    if (quota1 <= QUOTA_FAILOVER_THRESHOLD && KEY_2) {
      console.log(`🔄 KEY_1 low (${quota1} chars) — switching to KEY_2`);
      const quota2 = await getQuota(KEY_2);
      if (quota2 > QUOTA_FAILOVER_THRESHOLD) {
        activeKey = KEY_2;
        keyLabel = "KEY_2";
      } else {
        return NextResponse.json({ error: "Both keys exhausted", fallback: true }, { status: 429 });
      }
    }

    console.log(`🎙️  ElevenLabs TTS → ${keyLabel}, voice: ${resolvedVoiceId} (${companionId || "unknown companion"}), ~${quota1} chars remaining`);

    // ── GENERATE AUDIO ────────────────────────────────────────────────────────
    const { buffer, error } = await callElevenLabs(cleanText, resolvedVoiceId, activeKey);

    if (!buffer) {
      // Try other key as emergency fallback
      if (KEY_2 && activeKey === KEY_1) {
        console.log("🔄 Emergency fallback to KEY_2");
        const { buffer: buf2 } = await callElevenLabs(cleanText, resolvedVoiceId, KEY_2);
        if (buf2) {
          const updatedQuota = await getQuota(KEY_2);
          return new NextResponse(buf2, {
            status: 200,
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Length": String(buf2.byteLength),
              "X-EL-Remaining": String(updatedQuota),
              "X-EL-Key": "KEY_2_FALLBACK",
            },
          });
        }
      }
      console.error("All TTS attempts failed:", error);
      return NextResponse.json({ error: "TTS failed", fallback: true }, { status: 500 });
    }

    // ── UPDATE QUOTA ──────────────────────────────────────────────────────────
    const updatedQuota = await getQuota(activeKey);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(buffer.byteLength),
        "X-EL-Remaining": String(updatedQuota),
        "X-EL-Key": keyLabel,
      },
    });

  } catch (err) {
    console.error("TTS route error:", err);
    return NextResponse.json({ error: "Internal error", fallback: true }, { status: 500 });
  }
}
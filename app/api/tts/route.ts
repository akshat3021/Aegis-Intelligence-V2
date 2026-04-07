// app/api/tts/route.ts
import { NextRequest, NextResponse } from "next/server";

// FREE PREMADE VOICE IDs (work on free ElevenLabs accounts)
const FREE_VOICES: Record<string, string> = {
  rachel: "21m00Tcm4TlvDq8ikWAM", // warm friendly female → Squish
  adam:   "pNInz6obpgDQGcFmaJgB", // deep authoritative male → Eva
  elli:   "MF3mGyEYCl7XYWbV9V6O", // young energetic female → Spark
  bella:  "EXAVITQu4vr4xnSDxMaL", // soft friendly female
  josh:   "TxGEqnHWrfWFTfGW9XjX", // deep young male
  sam:    "yoZ06aMxZJJ28mfd3POQ",  // raspy approachable male
};

const COMPANION_VOICE_MAP: Record<string, string> = {
  squish: FREE_VOICES.rachel,
  eva:    FREE_VOICES.adam,
  spark:  FREE_VOICES.elli,
};

async function getQuota(apiKey: string): Promise<number> {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return (data?.character_limit ?? 10000) - (data?.character_count ?? 0);
  } catch { return 0; }
}

async function callElevenLabs(text: string, voiceId: string, apiKey: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
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
  return res.arrayBuffer();
}

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId: rawVoiceId, companionId } = await req.json();
    if (!text) return NextResponse.json({ error: "No text", fallback: true }, { status: 400 });

    // Resolve to a free voice — NEVER use library voices on free tier
    const resolvedVoiceId =
      COMPANION_VOICE_MAP[companionId] ||
      (rawVoiceId && Object.values(FREE_VOICES).includes(rawVoiceId) ? rawVoiceId : null) ||
      FREE_VOICES.rachel;

    const cleanText = text.replace(/\[.*?\]/g, "").replace(/[*_#`]/g, "").trim().slice(0, 500);

    const KEY_1 = process.env.ELEVENLABS_API_KEY_1 || process.env.ELEVENLABS_API_KEY || "";
    const KEY_2 = process.env.ELEVENLABS_API_KEY_2 || "";
    if (!KEY_1) return NextResponse.json({ error: "No API key", fallback: true }, { status: 503 });

    let activeKey = KEY_1, keyLabel = "KEY_1";
    const quota1 = await getQuota(KEY_1);
    if (quota1 <= 500 && KEY_2) {
      const quota2 = await getQuota(KEY_2);
      if (quota2 > 500) { activeKey = KEY_2; keyLabel = "KEY_2"; }
      else return NextResponse.json({ error: "Quota exhausted", fallback: true }, { status: 429 });
    }

    console.log(`🎙️ ElevenLabs → ${keyLabel}, voice: ${resolvedVoiceId} (${companionId})`);
    let buffer = await callElevenLabs(cleanText, resolvedVoiceId, activeKey);

    if (!buffer && KEY_2 && activeKey === KEY_1) {
      buffer = await callElevenLabs(cleanText, resolvedVoiceId, KEY_2);
      keyLabel = "KEY_2_FALLBACK";
    }

    if (!buffer) return NextResponse.json({ error: "TTS failed", fallback: true }, { status: 500 });

    const remaining = await getQuota(activeKey);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(buffer.byteLength),
        "X-EL-Remaining": String(remaining),
        "X-EL-Key": keyLabel,
      },
    });
  } catch (err) {
    console.error("TTS error:", err);
    return NextResponse.json({ error: "Internal error", fallback: true }, { status: 500 });
  }
}
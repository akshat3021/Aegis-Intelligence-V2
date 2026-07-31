// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SYSTEM_PROMPTS: Record<string, string> = {
  squish: `You are Squish, a warm and friendly AI companion. You are cheerful, supportive, and always encouraging. You speak in a casual, friendly tone with occasional emojis. You remember the user's goals and past conversations, and reference them naturally. If the user was stressed recently, acknowledge it gently. Keep responses concise (2-4 sentences max) unless asked for more.`,
  eva:    `You are Eva, a precise and technical AI companion. You speak in a calm, analytical tone. You are efficient and data-driven, but not cold. You remember the user's objectives and past interactions, referencing them when relevant. Keep responses concise and accurate. 2-4 sentences unless asked for more.`,
  spark:  `You are Spark, an extremely enthusiastic and high-energy AI companion!! You speak with LOTS of excitement, emojis, and caps for emphasis!! You are the ultimate hype person. Keep responses 2-4 sentences but PACKED with energy!!`,
};

function buildMoodContext(moodHistory: { mood: string; date: string }[]): string {
  if (!moodHistory?.length) return "";
  const recent = moodHistory.slice(-7);
  const parts = [];
  if (recent.filter(m => m.mood === "stressed").length >= 2) parts.push("User has been stressed recently — be extra supportive");
  if (recent.filter(m => m.mood === "happy").length >= 3)   parts.push("User has been in great mood — match their energy");
  if (recent.filter(m => m.mood === "focused").length >= 2) parts.push("User has been in focused work mode — be efficient");
  return parts.length ? `\n\nMOOD CONTEXT: ${parts.join(". ")}.` : "";
}

export async function POST(req: NextRequest) {
  try {
    const { message, companionId = "squish", chatHistory = [], userProfile, currentMood, moodHistory = [], userId } = await req.json();
    if (!message) return NextResponse.json({ error: "No message" }, { status: 400 });

    // Lazy Supabase init — MUST be inside function to avoid build-time crash
    let supabaseAdmin: ReturnType<typeof createClient> | null = null;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      supabaseAdmin = createClient(supabaseUrl, serviceKey);
    }

    const systemPrompt =
      (SYSTEM_PROMPTS[companionId] || SYSTEM_PROMPTS.squish) +
      (userProfile?.full_name ? `\n\nUSER: Name: ${userProfile.full_name}. Objective: ${userProfile.objective || "Not set"}.` : "") +
      buildMoodContext(moodHistory) +
      (currentMood && currentMood !== "neutral" ? `\n\nCURRENT MOOD: User seems ${currentMood} right now.` : "");

    // Load DB history ONLY as a fallback when the frontend sends no session context.
    // Bug #11 fix: if chatHistory.length > 0, frontend already has the right context;
    // merging with DB would send duplicate messages and confuse the AI.
    let dbHistory: { role: string; content: string }[] = [];
    if (userId && supabaseAdmin && chatHistory.length === 0) {
      try {
        const { data } = await supabaseAdmin.from("messages").select("role, content").eq("user_id", userId).eq("companion_id", companionId).order("created_at", { ascending: true }).limit(20);
        if (data?.length) dbHistory = data.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));
      } catch (e) { console.warn("Could not load DB history:", e); }
    }

    const contextHistory = chatHistory.length > 0 ? chatHistory.slice(-10) : dbHistory.slice(-10);

    // ── GROQ: llama3-8b-8192 is DECOMMISSIONED. Use llama-3.1-8b-instant instead ──
    // See: https://console.groq.com/docs/deprecations
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",   // ← UPDATED: was "llama3-8b-8192" (decommissioned)
        messages: [
          { role: "system", content: systemPrompt },
          ...contextHistory.map((m: any) => ({ role: m.role, content: m.content })),
          { role: "user", content: message },
        ],
        max_tokens: 300,
        temperature: companionId === "eva" ? 0.4 : companionId === "spark" ? 0.9 : 0.7,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error("Groq error:", err);
      return NextResponse.json({ error: "AI error" }, { status: 500 });
    }

    const groqData = await groqRes.json();
    const reply = groqData.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";

    // Save to Supabase
    if (userId && supabaseAdmin) {
      try {
        const messagesToInsert = [
          { user_id: userId, companion_id: companionId, role: "user",      content: message, mood: currentMood || "neutral", created_at: new Date().toISOString() },
          { user_id: userId, companion_id: companionId, role: "assistant", content: reply,   mood: null, created_at: new Date(Date.now() + 1).toISOString() },
        ] as any;
        await supabaseAdmin.from("messages").insert(messagesToInsert);
      } catch (e) { console.warn("Could not save messages:", e); }
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
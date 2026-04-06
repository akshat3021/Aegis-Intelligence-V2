// app/api/chat/route.ts
// This route handles AI chat + saves conversation history to Supabase
// so chats persist across devices and sessions.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service role client (bypasses RLS for server-side operations)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Add this to your .env
);

// ── COMPANION SYSTEM PROMPTS ──────────────────────────────────────────────────
const SYSTEM_PROMPTS: Record<string, string> = {
  squish: `You are Squish, a warm and friendly AI companion. You are cheerful, supportive, and always encouraging. You speak in a casual, friendly tone with occasional emojis. You remember the user's goals and past conversations, and reference them naturally. If the user was stressed recently, acknowledge it gently. Keep responses concise (2-4 sentences max) unless asked for more.`,

  eva: `You are Eva, a precise and technical AI companion. You speak in a calm, analytical tone. You are efficient and data-driven, but not cold. You remember the user's objectives and past interactions, referencing them when relevant. You occasionally use technical terminology. Keep responses concise and accurate. Format: 2-4 sentences unless asked for more.`,

  spark: `You are Spark, an extremely enthusiastic and high-energy AI companion!! You speak with LOTS of excitement, emojis, and caps lock for emphasis!! You are the ultimate hype person - you celebrate every win and encourage through every challenge. You remember what the user has been working on and reference it with excitement!! Keep responses 2-4 sentences but PACKED with energy!!`,
};

// ── MOOD CONTEXT BUILDER ──────────────────────────────────────────────────────
function buildMoodContext(moodHistory: {mood: string; date: string}[]): string {
  if (!moodHistory?.length) return "";
  const recent = moodHistory.slice(-7);
  const stressed = recent.filter(m => m.mood === "stressed");
  const happy    = recent.filter(m => m.mood === "happy");
  const focused  = recent.filter(m => m.mood === "focused");

  const parts = [];
  if (stressed.length >= 2) parts.push("User has been stressed multiple times recently - be extra supportive");
  if (happy.length >= 3) parts.push("User has been in a great mood lately - match their energy");
  if (focused.length >= 2) parts.push("User has been in focused/work mode - be efficient and goal-oriented");

  return parts.length ? `\n\nMOOD CONTEXT: ${parts.join(". ")}.` : "";
}

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      companionId = "squish",
      chatHistory = [],
      userProfile,
      currentMood,
      moodHistory = [],
      userId,       // Pass this from the client
    } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "No message" }, { status: 400 });
    }

    // ── BUILD SYSTEM PROMPT ───────────────────────────────────────────────────
    const basePrompt = SYSTEM_PROMPTS[companionId] || SYSTEM_PROMPTS.squish;
    const moodCtx = buildMoodContext(moodHistory);
    const profileCtx = userProfile?.full_name
      ? `\n\nUSER PROFILE: Name: ${userProfile.full_name}. Persona: ${userProfile.persona || "General"}. Objective: ${userProfile.objective || "Not set"}.`
      : "";
    const currentMoodCtx = currentMood && currentMood !== "neutral"
      ? `\n\nCURRENT MOOD: User seems ${currentMood} right now.`
      : "";

    const systemPrompt = basePrompt + profileCtx + moodCtx + currentMoodCtx;

    // ── LOAD RECENT CHAT HISTORY FROM SUPABASE ────────────────────────────────
    // This ensures the AI has context from previous sessions
    let dbHistory: {role: string; content: string}[] = [];
    if (userId) {
      try {
        const { data: savedMsgs } = await supabaseAdmin
          .from("messages")
          .select("role, content")
          .eq("user_id", userId)
          .eq("companion_id", companionId)
          .order("created_at", { ascending: true })
          .limit(20); // Last 20 messages for context

        if (savedMsgs && savedMsgs.length > 0) {
          dbHistory = savedMsgs.map(m => ({ role: m.role, content: m.content }));
        }
      } catch (e) {
        console.warn("Could not load DB history:", e);
      }
    }

    // Merge DB history with client-provided recent history (deduplicate)
    // Use client history if it has more recent messages
    const contextHistory = chatHistory.length > 0
      ? chatHistory.slice(-10) // Use last 10 from client
      : dbHistory.slice(-10);  // Fall back to DB

    // ── CALL GROQ AI ──────────────────────────────────────────────────────────
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
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
      return NextResponse.json({ error: "AI service error", fallback: true }, { status: 500 });
    }

    const groqData = await groqRes.json();
    const reply = groqData.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";

    // ── SAVE BOTH MESSAGES TO SUPABASE ────────────────────────────────────────
    if (userId) {
      try {
        const now = new Date().toISOString();
        await supabaseAdmin.from("messages").insert([
          {
            user_id: userId,
            companion_id: companionId,
            role: "user",
            content: message,
            mood: currentMood || "neutral",
            created_at: now,
          },
          {
            user_id: userId,
            companion_id: companionId,
            role: "assistant",
            content: reply,
            created_at: new Date(Date.now() + 1).toISOString(),
          },
        ]);
      } catch (e) {
        // Don't fail the response if saving fails
        console.warn("Could not save messages to DB:", e);
      }
    }

    return NextResponse.json({ reply });

  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
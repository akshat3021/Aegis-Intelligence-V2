// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildSystemPrompt } from "@/lib/ai/context";
import { getCompanionConfig } from "@/lib/ai/companions";
import { extractAndSaveMemories } from "@/lib/ai/memoryExtraction";

const GROQ_MODEL = "openai/gpt-oss-20b"; // change here if Groq retires it again

/**
 * Fallback prompt used only when we can't reach Supabase (missing env vars)
 * or don't have a userId yet — e.g. a guest/anonymous session.
 * No memory, mood trend, or tasks — just the companion's personality.
 */
function buildFallbackPrompt(companionId: string): { systemPrompt: string; temperature: number } {
  const companion = getCompanionConfig(companionId);
  const systemPrompt = [
    companion.systemPrompt,
    "",
    "Speech patterns:",
    ...companion.speechPatterns.map((p) => `- ${p}`),
    "",
    "Hard limits:",
    ...companion.toneLimits.map((l) => `- ${l}`),
  ].join("\n");
  return { systemPrompt, temperature: companion.temperature };
}

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      companionId = "squish",
      chatHistory = [],
      userProfile,
      currentMood = "neutral",
      moodHistory = [],
      userId,
    } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "No message" }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY is not set");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // Lazy Supabase init — must be inside the function to avoid a build-time crash
    let supabaseAdmin: SupabaseClient | null = null;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      supabaseAdmin = createClient(supabaseUrl, serviceKey);
    }

    // ── Build the system prompt ────────────────────────────────────────────
    let systemPrompt: string;
    let temperature: number;

    if (supabaseAdmin && userId) {
      const result = await buildSystemPrompt({
        companionId,
        userId,
        currentMessage: message,
        currentMood,
        moodHistory,
        userProfile: userProfile || {},
        supabaseAdmin,
      });
      systemPrompt = result.systemPrompt;
      temperature = result.temperature;

      if (process.env.AEGIS_DEBUG === "true") {
        console.log(`[AEGIS CONTEXT] token estimate: ${result.tokenEstimate}`);
      }
    } else {
      const fallback = buildFallbackPrompt(companionId);
      systemPrompt = fallback.systemPrompt;
      temperature = fallback.temperature;
    }

    // Load DB history only as a fallback when the frontend sends no session context.
    let dbHistory: { role: string; content: string }[] = [];
    if (userId && supabaseAdmin && chatHistory.length === 0) {
      try {
        const { data } = await supabaseAdmin
          .from("messages")
          .select("role, content")
          .eq("user_id", userId)
          .eq("companion_id", companionId)
          .order("created_at", { ascending: true })
          .limit(20);
        if (data?.length) {
          dbHistory = data.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          }));
        }
      } catch (e) {
        console.warn("Could not load DB history:", e);
      }
    }

    const contextHistory = chatHistory.length > 0 ? chatHistory.slice(-10) : dbHistory.slice(-10);

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...contextHistory.map((m: any) => ({ role: m.role, content: m.content })),
          { role: "user", content: message },
        ],
        max_tokens: 1024,
        reasoning_effort: "low",
        temperature,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error("Groq error:", groqRes.status, err);
      return NextResponse.json({ error: "AI error" }, { status: 500 });
    }

    const groqData = await groqRes.json();
    const reply =
      groqData.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";

    // Save to Supabase
    if (userId && supabaseAdmin) {
      try {
        const messagesToInsert = [
          {
            user_id: userId,
            companion_id: companionId,
            role: "user",
            content: message,
            mood: currentMood || "neutral",
            created_at: new Date().toISOString(),
          },
          {
            user_id: userId,
            companion_id: companionId,
            role: "assistant",
            content: reply,
            mood: null,
            created_at: new Date(Date.now() + 1).toISOString(),
          },
        ] as any;
        await supabaseAdmin.from("messages").insert(messagesToInsert);
      } catch (e) {
        console.warn("Could not save messages:", e);
      }
    }

    // ── Auto memory extraction — runs AFTER the response is sent ──────────
    // Uses Next.js's after() so this never adds latency to the chat reply.
    // Only runs for real logged-in users with a working Supabase connection.
    if (userId && supabaseAdmin) {
      const supabaseForBackground = supabaseAdmin; // narrow the type for the closure below
      after(async () => {
        await extractAndSaveMemories({
          userMessage: message,
          assistantReply: reply,
          userId,
          companionId,
          supabaseAdmin: supabaseForBackground,
        });
      });
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

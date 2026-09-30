// lib/ai/memoryExtraction.ts
// ─── Automatic memory extraction ──────────────────────────────────────────
// After each chat exchange, asks the model whether anything durable and
// worth remembering was shared (a preference, goal, fact, topic, or habit),
// and if so, saves it to user_memory automatically.
//
// Runs AFTER the user's reply has already been sent (see route.ts's use of
// next/server's `after()`), so this never adds latency to the chat itself.
// Failures here are always non-fatal — memory extraction breaking should
// never break the chat experience.

import type { SupabaseClient } from "@supabase/supabase-js";
import { validateMemoryContent, sanitizeMemoryContent } from "./memory";

const EXTRACTION_MODEL = "openai/gpt-oss-20b";

/** Max new memories saved per single chat exchange — keeps growth sane */
const MAX_NEW_MEMORIES_PER_TURN = 2;

interface ExtractedMemory {
  content: string;
  category: "preference" | "goal" | "fact" | "topic" | "habit";
  relevance_score: number;
}

interface ExtractionResponse {
  memories: ExtractedMemory[];
}

const EXTRACTION_SYSTEM_PROMPT = `You analyze a single chat exchange between a user and their AI companion, and decide whether anything durable and worth remembering long-term was shared.

Extract a memory ONLY if the user shared something like:
- A stated preference ("I hate mornings", "I prefer short answers")
- A goal or objective ("I'm trying to learn Spanish this year")
- A concrete fact about their life ("I have a dog named Max", "I work as a nurse")
- A recurring topic they care about ("I'm training for a marathon")
- A habit or pattern ("I always procrastinate on Sundays")

Do NOT extract:
- Generic emotional statements with no lasting fact ("I'm stressed today")
- One-off situational details unlikely to matter later
- Anything already obvious or trivial

Respond ONLY with JSON in this exact shape, nothing else:
{"memories": [{"content": "...", "category": "preference|goal|fact|topic|habit", "relevance_score": 1-10}]}

If nothing is worth remembering, respond with: {"memories": []}

Keep each "content" under 200 characters, written as a short third-person fact (e.g. "Prefers short, direct answers" not "I prefer short answers").`;

export async function extractAndSaveMemories({
  userMessage,
  assistantReply,
  userId,
  companionId,
  supabaseAdmin,
}: {
  userMessage: string;
  assistantReply: string;
  userId: string;
  companionId: string;
  supabaseAdmin: SupabaseClient;
}): Promise<void> {
  if (!process.env.GROQ_API_KEY) return;

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: `User said: "${userMessage}"\n\nCompanion replied: "${assistantReply}"`,
          },
        ],
        max_tokens: 300,
        reasoning_effort: "low",
        temperature: 0.2, // low — this is a classification task, not creative writing
        response_format: { type: "json_object" },
      }),
    });

    if (!groqRes.ok) {
      console.warn("Memory extraction Groq call failed:", groqRes.status);
      return;
    }

    const data = await groqRes.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) return;

    let parsed: ExtractionResponse;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.warn("Memory extraction returned invalid JSON, skipping:", rawContent);
      return;
    }

    const memories = (parsed.memories || []).slice(0, MAX_NEW_MEMORIES_PER_TURN);
    if (memories.length === 0) return;

    const rowsToInsert = [];
    for (const mem of memories) {
      const validation = validateMemoryContent(mem.content);
      if (!validation.valid) {
        console.warn("Skipping invalid extracted memory:", validation.reason);
        continue;
      }
      const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
      rowsToInsert.push({
        user_id: userId,
        content: sanitizeMemoryContent(mem.content),
        category: mem.category,
        relevance_score: clamp(Number(mem.relevance_score) || 5, 1, 10),
        // 'source' distinguishes auto-extracted memories from ones a user
        // manually added. Must match the DB check constraint exactly:
        // 'manual' | 'auto' | 'system'.
        source: "auto",
        created_at: new Date().toISOString(),
        last_referenced_at: new Date().toISOString(),
      });
    }

    if (rowsToInsert.length === 0) return;

    const { error } = await supabaseAdmin.from("user_memory").insert(rowsToInsert);
    if (error) {
      console.warn("Could not insert extracted memories:", error.message);
    } else if (process.env.AEGIS_DEBUG === "true") {
      console.log(
        `[AEGIS MEMORY] Extracted ${rowsToInsert.length} new memor${rowsToInsert.length === 1 ? "y" : "ies"} for user ${userId} (companion: ${companionId})`
      );
    }
  } catch (e) {
    // Never let extraction failures affect the chat experience
    console.warn("Memory extraction failed (non-fatal):", e);
  }
}

// lib/ai/memory.ts
// ─── User memory query & management ─────────────────────────────────────────
// Fetches relevant persistent facts about the user from the user_memory table.
// Handles the prompt-injection-safe formatting for inclusion in system prompts.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface UserMemoryItem {
  id: string;
  content: string;
  category: string;
  relevance_score: number;
  last_referenced_at: string;
  created_at: string;
}

/** Maximum number of memory items injected into any single prompt */
const MAX_MEMORY_ITEMS = 10;

/** Maximum allowed character length for a single memory item (matches DB constraint) */
const MAX_MEMORY_CONTENT_LENGTH = 500;

/**
 * Fetch the user's most relevant memories for prompt injection.
 * Ordered by relevance_score DESC, then last_referenced_at DESC.
 * Capped at MAX_MEMORY_ITEMS to control token cost.
 */
export async function fetchUserMemories(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<UserMemoryItem[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_memory")
      .select("id, content, category, relevance_score, last_referenced_at, created_at")
      .eq("user_id", userId)
      .order("relevance_score", { ascending: false })
      .order("last_referenced_at", { ascending: false })
      .limit(MAX_MEMORY_ITEMS);

    if (error) {
      console.warn("Could not fetch user memories:", error.message);
      return [];
    }

    return (data as UserMemoryItem[]) || [];
  } catch (e) {
    console.warn("User memory fetch failed:", e);
    return [];
  }
}

/**
 * Touch the last_referenced_at timestamp for memories that were actually
 * included in a prompt. This keeps frequently-used memories surfaced.
 * Runs fire-and-forget — we don't block on this.
 */
export async function touchMemories(
  supabaseAdmin: SupabaseClient,
  memoryIds: string[]
): Promise<void> {
  if (memoryIds.length === 0) return;
  try {
    await supabaseAdmin
      .from("user_memory")
      .update({ last_referenced_at: new Date().toISOString() })
      .in("id", memoryIds);
  } catch (e) {
    console.warn("Could not touch memory timestamps:", e);
  }
}

/**
 * Sanitize a memory content string for safe inclusion in a prompt.
 * Strips control characters, trims, and enforces length limit.
 */
export function sanitizeMemoryContent(content: string): string {
  return content
    .replace(/[\x00-\x1F\x7F]/g, "") // strip control chars
    .trim()
    .slice(0, MAX_MEMORY_CONTENT_LENGTH);
}

/**
 * Build the memory section of the system prompt.
 * Returns an empty string if the user has no memories.
 */
export function buildMemorySection(memories: UserMemoryItem[]): string {
  if (!memories || memories.length === 0) return "";

  const lines = memories.map(
    (m) => `- ${sanitizeMemoryContent(m.content)}`
  );

  return [
    "\n[USER MEMORY — things you know about this user]",
    ...lines,
    "",
    "Important: Only reference facts listed above. Never invent or assume additional facts about the user.",
  ].join("\n");
}

/**
 * Validate a memory content string before inserting into the DB.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function validateMemoryContent(
  content: unknown
): { valid: true } | { valid: false; reason: string } {
  if (typeof content !== "string") {
    return { valid: false, reason: "Content must be a string." };
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return { valid: false, reason: "Content must not be empty." };
  }

  if (trimmed.length > MAX_MEMORY_CONTENT_LENGTH) {
    return {
      valid: false,
      reason: `Content must be ${MAX_MEMORY_CONTENT_LENGTH} characters or fewer (got ${trimmed.length}).`,
    };
  }

  // Basic prompt-injection heuristic: reject content that looks like it's
  // trying to override system instructions
  const suspiciousPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /you\s+are\s+now\s+/i,
    /system\s*:\s*/i,
    /\[SYSTEM\]/i,
    /\[INST\]/i,
  ];
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        reason: "Content contains disallowed patterns.",
      };
    }
  }

  return { valid: true };
}

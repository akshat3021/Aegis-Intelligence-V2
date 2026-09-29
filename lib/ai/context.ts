// lib/ai/context.ts
// ─── Context Assembly — the core orchestration layer ─────────────────────────
// Assembles a rich, token-controlled system prompt before every Groq call.
// This is the ONLY file that needs to know about all the context sources.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompanionConfig } from "./companions";
import { buildMoodSection, detectMood, type MoodHistoryEntry } from "./mood";
import {
  fetchUserMemories,
  buildMemorySection,
  touchMemories,
} from "./memory";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BuildPromptParams {
  companionId: string;
  userId: string;
  currentMessage: string;
  currentMood: string;
  moodHistory: MoodHistoryEntry[];
  userProfile: { full_name?: string; objective?: string };
  supabaseAdmin: SupabaseClient;
}

export interface BuildPromptResult {
  /** The assembled system prompt to send to Groq */
  systemPrompt: string;
  /** Estimated token count for the system prompt (~4 chars per token) */
  tokenEstimate: number;
  /** The companion's preferred temperature */
  temperature: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Max pending tasks to include in the prompt */
const MAX_TASKS_IN_PROMPT = 8;

/** Rough chars-per-token estimate for token budgeting */
const CHARS_PER_TOKEN = 4;

// ─── Task fetching ───────────────────────────────────────────────────────────

interface TaskRow {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
}

/**
 * Fetch the user's tasks and build the task section of the system prompt.
 */
async function buildTaskSection(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<string> {
  try {
    // Fetch recent tasks — both pending and recently completed
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .select("id, text, completed, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) return "";

    const tasks = data as TaskRow[];
    const pending = tasks.filter((t) => !t.completed);
    const completed = tasks.filter((t) => t.completed);

    if (pending.length === 0 && completed.length === 0) return "";

    const lines: string[] = ["\n[ACTIVE TASKS — the user's current to-do list]"];

    // Show pending tasks (capped)
    if (pending.length > 0) {
      const shown = pending.slice(0, MAX_TASKS_IN_PROMPT);
      for (const task of shown) {
        const age = getTaskAge(task.created_at);
        lines.push(`- "${task.text}" (${age}, still pending)`);
      }
      if (pending.length > MAX_TASKS_IN_PROMPT) {
        lines.push(
          `- ...and ${pending.length - MAX_TASKS_IN_PROMPT} more pending tasks.`
        );
      }
    }

    // Summarize completed tasks (don't list them all)
    if (completed.length > 0) {
      lines.push(
        `\n${completed.length} task${completed.length > 1 ? "s" : ""} completed recently — acknowledge their progress when relevant!`
      );
    }

    return lines.join("\n");
  } catch (e) {
    console.warn("Could not fetch tasks for context:", e);
    return "";
  }
}

/**
 * Human-readable age string for a task.
 */
function getTaskAge(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "created today";
  if (diffDays === 1) return "created yesterday";
  if (diffDays < 7) return `created ${diffDays} days ago`;
  if (diffDays < 30) return `created ${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
  return `created ${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? "s" : ""} ago`;
}

// ─── Response guidelines ─────────────────────────────────────────────────────

function buildGuidelinesSection(companionId: string): string {
  const base = [
    "Keep responses to 2-4 sentences unless the user explicitly asks for more detail.",
    "Reference the user's tasks naturally when relevant — don't force it into every message.",
    "Never fabricate facts about the user. Only reference what is in [USER MEMORY] or [ACTIVE TASKS].",
    "If the user shares something important about themselves, you may note it naturally in conversation.",
  ];

  const companionSpecific: Record<string, string[]> = {
    squish: [
      "Be warm and encouraging but not saccharine. Vary your responses.",
    ],
    eva: [
      "Be efficient and precise. If the user has pending tasks, you may proactively suggest prioritization.",
    ],
    spark: [
      "Be HYPED but still helpful. Channel your energy into actionable motivation!!",
    ],
  };

  const specific = companionSpecific[companionId] || [];

  return `\n[RESPONSE GUIDELINES]\n${[...base, ...specific].map((l) => `- ${l}`).join("\n")}`;
}

// ─── Main orchestrator ───────────────────────────────────────────────────────

/**
 * Assemble the full system prompt for a Groq chat completion request.
 *
 * Sections (in order):
 * 1. Companion personality + speech patterns + tone limits
 * 2. User identity (name, objective)
 * 3. Mood context (current + trend)
 * 4. User memory (persistent facts)
 * 5. Active tasks
 * 6. Response guidelines
 *
 * Each section is clearly delimited with bracketed headers so the model
 * can distinguish between context types.
 */
export async function buildSystemPrompt(
  params: BuildPromptParams
): Promise<BuildPromptResult> {
  const {
    companionId,
    userId,
    currentMessage,
    currentMood,
    moodHistory,
    userProfile,
    supabaseAdmin,
  } = params;

  const companion = getCompanionConfig(companionId);

  // ── Section 1: Personality ─────────────────────────────────────────────────
  const personalitySection = [
    companion.systemPrompt,
    "",
    "Speech patterns:",
    ...companion.speechPatterns.map((p) => `- ${p}`),
    "",
    "Hard limits:",
    ...companion.toneLimits.map((l) => `- ${l}`),
  ].join("\n");

  // ── Section 2: User identity ───────────────────────────────────────────────
  const identityParts: string[] = [];
  if (userProfile?.full_name) {
    identityParts.push(`Name: ${userProfile.full_name}`);
  }
  if (userProfile?.objective) {
    identityParts.push(`Current objective: ${userProfile.objective}`);
  }
  const identitySection =
    identityParts.length > 0
      ? `\n[USER IDENTITY]\n${identityParts.join("\n")}`
      : "";

  // ── Section 3: Mood ────────────────────────────────────────────────────────
  // Use server-side mood detection on the current message as ground truth,
  // but also accept the client-provided mood as a signal
  const serverDetectedMood = detectMood(currentMessage);
  const effectiveMood =
    serverDetectedMood !== "neutral" ? serverDetectedMood : currentMood;
  const moodSection = buildMoodSection(effectiveMood, moodHistory);

  // ── Section 4: Memory ──────────────────────────────────────────────────────
  // Fetch from Supabase — graceful fallback if table doesn't exist yet
  const memories = await fetchUserMemories(supabaseAdmin, userId);
  const memorySection = buildMemorySection(memories);

  // Fire-and-forget: update last_referenced_at for used memories
  if (memories.length > 0) {
    touchMemories(
      supabaseAdmin,
      memories.map((m) => m.id)
    ).catch(() => {});
  }

  // ── Section 5: Tasks ───────────────────────────────────────────────────────
  const taskSection = await buildTaskSection(supabaseAdmin, userId);

  // ── Section 6: Guidelines ──────────────────────────────────────────────────
  const guidelinesSection = buildGuidelinesSection(companionId);

  // ── Assemble ───────────────────────────────────────────────────────────────
  const systemPrompt = [
    personalitySection,
    identitySection,
    moodSection,
    memorySection,
    taskSection,
    guidelinesSection,
  ]
    .filter(Boolean)
    .join("\n");

  const tokenEstimate = Math.ceil(systemPrompt.length / CHARS_PER_TOKEN);

  if (process.env.AEGIS_DEBUG === "true") {
    console.log(
      `[AEGIS CONTEXT] Companion: ${companionId} | Mood: ${effectiveMood} | Memories: ${memories.length} | Token est: ${tokenEstimate}`
    );
  }

  return {
    systemPrompt,
    tokenEstimate,
    temperature: companion.temperature,
  };
}

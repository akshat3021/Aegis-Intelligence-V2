// lib/ai/mood.ts
// ─── Server-side mood detection & context builder ────────────────────────────
// Rule-based keyword detection (no ML). Designed to be swapped for a real
// classifier later without changing the interface.

export type Mood = "stressed" | "happy" | "focused" | "neutral";

export interface MoodHistoryEntry {
  mood: string;
  date: string;
}

// ─── Keyword patterns (order matters: first match wins) ─────────────────────
const MOOD_PATTERNS: { mood: Mood; pattern: RegExp }[] = [
  {
    mood: "stressed",
    pattern:
      /\b(stress|overwhelm|tired|exhaust|anxious|can'?t|stuck|panic|fail|hard|struggle|burnout|frustrated|angry|upset|worried|nervous|afraid|scared|crying|cry|hate|terrible|horrible|awful|miserable|hopeless|depressed|sad)\b/i,
  },
  {
    mood: "happy",
    pattern:
      /\b(happy|great|awesome|yay|love|excit|amazing|good|yes|wow|thanks|wonderful|fantastic|brilliant|proud|celebrate|grateful|blessed|joy|thrilled|pumped|stoked)\b/i,
  },
  {
    mood: "focused",
    pattern:
      /\b(focus|work|study|code|build|create|task|goal|deadline|project|plan|schedule|finish|complete|ship|grind|hustle|progress|milestone)\b/i,
  },
];

/**
 * Detect mood from a single message using keyword matching.
 * Returns "neutral" if no patterns match.
 */
export function detectMood(text: string): Mood {
  const normalized = text.toLowerCase();
  for (const { mood, pattern } of MOOD_PATTERNS) {
    if (pattern.test(normalized)) return mood;
  }
  return "neutral";
}

/**
 * Analyze mood trend from recent history entries.
 * Returns a short natural-language summary for the system prompt.
 */
export function analyzeMoodTrend(history: MoodHistoryEntry[]): string | null {
  if (!history || history.length === 0) return null;

  // Only look at the last 7 entries
  const recent = history.slice(-7);
  const total = recent.length;

  const counts: Record<string, number> = {};
  for (const entry of recent) {
    counts[entry.mood] = (counts[entry.mood] || 0) + 1;
  }

  const parts: string[] = [];

  if ((counts["stressed"] || 0) >= 2) {
    parts.push(
      `User has been stressed ${counts["stressed"]} of the last ${total} days — be extra supportive and acknowledge their efforts.`
    );
  }
  if ((counts["happy"] || 0) >= 3) {
    parts.push(
      `User has been in a great mood ${counts["happy"]} of the last ${total} days — match their positive energy.`
    );
  }
  if ((counts["focused"] || 0) >= 2) {
    parts.push(
      `User has been in deep focus mode ${counts["focused"]} of the last ${total} days — be efficient, minimize small talk.`
    );
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Build the mood section of the system prompt.
 * Combines current mood detection with historical trend analysis.
 */
export function buildMoodSection(
  currentMood: string,
  moodHistory: MoodHistoryEntry[]
): string {
  const lines: string[] = [];

  // Current mood
  if (currentMood && currentMood !== "neutral") {
    const guidance: Record<string, string> = {
      stressed:
        "Be extra gentle and supportive. Acknowledge their stress without dwelling on it. Offer to help break things down.",
      happy:
        "Match their positive energy. Celebrate with them. This is a great time to encourage progress on goals.",
      focused:
        "Be concise and efficient. Minimize chitchat. Help them stay in the zone.",
    };
    lines.push(`Current mood: ${currentMood}.`);
    if (guidance[currentMood]) {
      lines.push(`Guidance: ${guidance[currentMood]}`);
    }
  }

  // Trend
  const trend = analyzeMoodTrend(moodHistory);
  if (trend) {
    lines.push(`Recent trend: ${trend}`);
  }

  if (lines.length === 0) return "";

  return `\n[MOOD CONTEXT]\n${lines.join("\n")}`;
}

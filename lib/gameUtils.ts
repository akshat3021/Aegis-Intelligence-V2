// lib/gameUtils.ts
// Shared XP/level formula — single source of truth used by page.tsx and ShareCard.tsx.
// Bug #17 fix: previously page.tsx used (xp/80)^0.6 and ShareCard used level^1.667*80,
// which gave DIFFERENT values. Now both import from here.

/** Calculate the player's current level from total XP */
export const getLvl = (xp: number): number =>
  Math.floor(Math.pow(xp / 80, 0.6)) + 1;

/** Total XP required to REACH a given level */
export const getXPForLvl = (level: number): number =>
  Math.ceil(Math.pow(Math.max(0, level - 1), 1 / 0.6) * 80);

/**
 * XP progress percentage towards the NEXT level (0–100).
 * Guards against division by zero at level 1 / 0 XP.
 */
export const xpProgress = (xp: number): number => {
  const level  = getLvl(xp);
  const curXP  = getXPForLvl(level);
  const nxtXP  = getXPForLvl(level + 1);
  if (nxtXP <= curXP) return 0; // guard against div-by-zero
  return Math.min(100, ((xp - curXP) / (nxtXP - curXP)) * 100);
};

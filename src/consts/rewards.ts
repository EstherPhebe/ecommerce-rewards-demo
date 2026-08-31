import type { AchievementDef, BadgeDef } from "../services/achievementSummary";

// Single source of truth for the reward catalogue: prisma/seed.ts writes these
// rows, and the unit tests assert against them, so the two can't drift apart.
export const ACHIEVEMENT_CATALOG: AchievementDef[] = [
  { name: "first_purchase", group: "order_count", threshold: 1 },
  { name: "fifth_purchase", group: "order_count", threshold: 5 },
  { name: "tenth_purchase", group: "order_count", threshold: 10 },
  { name: "fifteenth_purchase", group: "order_count", threshold: 15 },
];

export const BADGE_CATALOG: BadgeDef[] = [
  { name: "bronze", achievementThreshold: 1 },
  { name: "silver", achievementThreshold: 5 },
  { name: "gold", achievementThreshold: 10 },
  { name: "diamond", achievementThreshold: 20 },
];

export interface AchievementDef {
  name: string;
  group: string;
  threshold: number;
}

export interface BadgeDef {
  name: string;
  achievementThreshold: number;
}

export interface AchievementSummary {
  unlocked_achievements: string[];
  next_available_achievements: string[];
  current_badge: string;
  next_badge: string;
  remaining_to_unlock_next_badge: number;
}

export function buildSummary(
  unlockedAchievements: string[],
  achievements: AchievementDef[],
  badges: BadgeDef[]
): AchievementSummary {
  const unlockedNames = new Set(unlockedAchievements);

  // Lowest-threshold achievement still locked in each group.
  const nextAvailable: string[] = [];
  const claimedGroups = new Set<string>();
  for (const achievement of [...achievements].sort(
    (a, b) => a.threshold - b.threshold
  )) {
    if (claimedGroups.has(achievement.group)) continue;
    if (unlockedNames.has(achievement.name)) continue;
    claimedGroups.add(achievement.group);
    nextAvailable.push(achievement.name);
  }

  const achievementsCount = unlockedNames.size;
  const tiers = [...badges].sort(
    (a, b) => a.achievementThreshold - b.achievementThreshold
  );

  const current = tiers
    .filter(b => b.achievementThreshold <= achievementsCount)
    .pop();
  const next = tiers.find(b => b.achievementThreshold > achievementsCount);

  return {
    unlocked_achievements: unlockedAchievements,
    next_available_achievements: nextAvailable,
    current_badge: current?.name ?? "",
    next_badge: next?.name ?? "",
    remaining_to_unlock_next_badge: next
      ? next.achievementThreshold - achievementsCount
      : 0,
  };
}

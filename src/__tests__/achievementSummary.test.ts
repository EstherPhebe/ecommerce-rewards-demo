import { describe, it, expect } from "@jest/globals";
import {
  buildSummary,
  type AchievementDef,
  type BadgeDef,
} from "../services/achievementSummary";
import { ACHIEVEMENT_CATALOG, BADGE_CATALOG } from "../consts/rewards";

// The seeded catalogue (prisma/seed.ts) is a single group of four
// achievements at 1/5/10/15 purchases, and badges at 1/5/10/20 achievements.
const ALL = ACHIEVEMENT_CATALOG.map(a => a.name);

describe("buildSummary — seeded catalogue", () => {
  it("handles a brand-new user (nothing unlocked)", () => {
    const s = buildSummary([], ACHIEVEMENT_CATALOG, BADGE_CATALOG);

    expect(s.unlocked_achievements).toEqual([]);
    expect(s.next_available_achievements).toEqual(["first_purchase"]);
    expect(s.current_badge).toBe("");
    expect(s.next_badge).toBe("bronze");
    expect(s.remaining_to_unlock_next_badge).toBe(1);
  });

  it("awards bronze and points at the next achievement after one unlock", () => {
    const s = buildSummary(
      ["first_purchase"],
      ACHIEVEMENT_CATALOG,
      BADGE_CATALOG
    );

    expect(s.unlocked_achievements).toEqual(["first_purchase"]);
    expect(s.next_available_achievements).toEqual(["fifth_purchase"]);
    expect(s.current_badge).toBe("bronze");
    expect(s.next_badge).toBe("silver");
    expect(s.remaining_to_unlock_next_badge).toBe(4);
  });

  it("returns only the lowest locked achievement, not every locked one", () => {
    const s = buildSummary(
      ["first_purchase", "fifth_purchase"],
      ACHIEVEMENT_CATALOG,
      BADGE_CATALOG
    );

    expect(s.next_available_achievements).toEqual(["tenth_purchase"]);
    expect(s.current_badge).toBe("bronze");
    expect(s.remaining_to_unlock_next_badge).toBe(3);
  });

  it("skips already-unlocked tiers when unlocks arrive out of order", () => {
    // Achievements are awarded by purchase count
    const s = buildSummary(
      ["first_purchase", "tenth_purchase"],
      ACHIEVEMENT_CATALOG,
      BADGE_CATALOG
    );

    expect(s.next_available_achievements).toEqual(["fifth_purchase"]);
  });

  it("reports an empty next achievement once the group is exhausted", () => {
    const s = buildSummary(ALL, ACHIEVEMENT_CATALOG, BADGE_CATALOG);

    expect(s.next_available_achievements).toEqual([]);
  });

  it("documents that silver and above are unreachable as seeded", () => {
    // Four achievements exist, so a fully-completed user sits at 4 and silver
    // (5) can never be earned. Failing here means the catalogue changed and
    // the badge thresholds need revisiting.
    expect(ALL.length).toBe(4);

    const s = buildSummary(ALL, ACHIEVEMENT_CATALOG, BADGE_CATALOG);

    expect(s.current_badge).toBe("bronze");
    expect(s.next_badge).toBe("silver");
    expect(s.remaining_to_unlock_next_badge).toBe(1);
  });
});

describe("buildSummary — general behaviour", () => {
  const MULTI: AchievementDef[] = [
    ...ACHIEVEMENT_CATALOG,
    { name: "first_review", group: "review_count", threshold: 1 },
    { name: "fifth_review", group: "review_count", threshold: 5 },
  ];

  it("returns one next achievement per group", () => {
    const s = buildSummary(
      ["first_purchase", "first_review"],
      MULTI,
      BADGE_CATALOG
    );

    expect(s.next_available_achievements.sort()).toEqual([
      "fifth_purchase",
      "fifth_review",
    ]);
  });

  it("omits groups that are fully unlocked", () => {
    const s = buildSummary([...ALL, "first_review"], MULTI, BADGE_CATALOG);

    expect(s.next_available_achievements).toEqual(["fifth_review"]);
  });

  it("does not depend on the order rows come back from the database", () => {
    const shuffled = [...ACHIEVEMENT_CATALOG].reverse();
    const shuffledBadges: BadgeDef[] = [...BADGE_CATALOG].reverse();

    expect(buildSummary(["first_purchase"], shuffled, shuffledBadges)).toEqual(
      buildSummary(["first_purchase"], ACHIEVEMENT_CATALOG, BADGE_CATALOG)
    );
  });

  it("does not mutate its inputs", () => {
    const achievements = [...ACHIEVEMENT_CATALOG].reverse();
    const snapshot = achievements.map(a => a.name);

    buildSummary([], achievements, BADGE_CATALOG);

    expect(achievements.map(a => a.name)).toEqual(snapshot);
  });

  it("ignores unlocked names that are no longer in the catalogue", () => {
    // A retired achievement still sits in user_achievements rows.
    const s = buildSummary(
      ["retired_achievement", "first_purchase"],
      ACHIEVEMENT_CATALOG,
      BADGE_CATALOG
    );

    expect(s.next_available_achievements).toEqual(["fifth_purchase"]);
    // It still counts toward badge progress, since badges count rows.
    expect(s.current_badge).toBe("bronze");
    expect(s.remaining_to_unlock_next_badge).toBe(3);
  });

  it("picks the highest earned tier when the count sits between thresholds", () => {
    const badges: BadgeDef[] = [
      { name: "basic", achievementThreshold: 1 },
      { name: "intermediate", achievementThreshold: 3 },
      { name: "advanced", achievementThreshold: 5 },
    ];

    const s = buildSummary(ALL, ACHIEVEMENT_CATALOG, badges);

    expect(s.current_badge).toBe("intermediate");
    expect(s.next_badge).toBe("advanced");
    expect(s.remaining_to_unlock_next_badge).toBe(1);
  });

  it("reports the top badge with no next badge", () => {
    const badges: BadgeDef[] = [{ name: "basic", achievementThreshold: 1 }];

    const s = buildSummary(ALL, ACHIEVEMENT_CATALOG, badges);

    expect(s.current_badge).toBe("basic");
    expect(s.next_badge).toBe("");
    expect(s.remaining_to_unlock_next_badge).toBe(0);
  });

  it("survives an empty catalogue", () => {
    const s = buildSummary([], [], []);

    expect(s).toEqual({
      unlocked_achievements: [],
      next_available_achievements: [],
      current_badge: "",
      next_badge: "",
      remaining_to_unlock_next_badge: 0,
    });
  });
});

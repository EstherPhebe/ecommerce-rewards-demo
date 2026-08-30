import prisma from "./client";

const REWARD_AMOUNT = Number(process.env.BADGE_REWARD_AMOUNT ?? 300);

const ACHIEVEMENTS = {
  order_count: {
    1: "first_purchase",
    5: "fifth_purchase",
    10: "tenth_purchase",
    15: "fifteenth_purchase",
  },
};

const BADGES = {
  1: "bronze",
  5: "silver",
  10: "gold",
  20: "diamond",
};

async function main() {
  for (const [group, achievement] of Object.entries(ACHIEVEMENTS)) {
    for (const [purchaseThreshold, achievementName] of Object.entries(
      achievement
    )) {
      await prisma.achievement.upsert({
        where: { name: achievementName },
        create: {
          name: achievementName,
          group,
          threshold: Number(purchaseThreshold),
        },
        update: {
          group,
          threshold: Number(purchaseThreshold),
        },
      });
    }

    for (const [achievementThreshold, badgeName] of Object.entries(BADGES)) {
      await prisma.badge.upsert({
        where: { name: badgeName },
        create: {
          name: badgeName,
          achievementThreshold: Number(achievementThreshold),
          cashbackAmount: Number(REWARD_AMOUNT),
        },
        update: {
          achievementThreshold: Number(achievementThreshold),
          cashbackAmount: Number(REWARD_AMOUNT),
        },
      });
    }
  }

  console.log("DB seed done");
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

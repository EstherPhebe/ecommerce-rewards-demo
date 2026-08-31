import prisma from "./client";
import { ACHIEVEMENT_CATALOG, BADGE_CATALOG } from "../src/consts/rewards";

const REWARD_AMOUNT = Number(process.env.BADGE_REWARD_AMOUNT ?? 300);

async function main() {
  for (const { name, group, threshold } of ACHIEVEMENT_CATALOG) {
    await prisma.achievement.upsert({
      where: { name },
      create: { name, group, threshold },
      update: { group, threshold },
    });
  }

  for (const { name, achievementThreshold } of BADGE_CATALOG) {
    await prisma.badge.upsert({
      where: { name },
      create: { name, achievementThreshold, cashbackAmount: REWARD_AMOUNT },
      update: { achievementThreshold, cashbackAmount: REWARD_AMOUNT },
    });
  }

  console.log("DB seed done");
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

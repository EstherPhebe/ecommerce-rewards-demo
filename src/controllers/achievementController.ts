import { Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import ErrorWithCode from "../utils/ErrorWithCode";
import { z } from "zod";
import prisma from "../../prisma/client";
import { buildSummary } from "../services/achievementSummary";

const userSchema = z.object({
  userId: z.string().min(1),
});

// GET /users/:userId/achievements
export const getUserAchievements = catchAsync(
  async (req: Request, res: Response) => {
    const { userId } = userSchema.parse(req.params);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        achievement: {
          orderBy: { unlockedAt: "asc" },
          select: { achievement: { select: { name: true } } },
        },
      },
    });

    if (!user) throw new ErrorWithCode("User not found", 404);

    const [achievements, badges] = await Promise.all([
      prisma.achievement.findMany({
        select: { name: true, group: true, threshold: true },
      }),
      prisma.badge.findMany({
        select: { name: true, achievementThreshold: true },
      }),
    ]);

    const unlockedAchievements = user.achievement.map(a => a.achievement.name);

    res.status(200).json({
      success: true,
      data: buildSummary(unlockedAchievements, achievements, badges),
    });
  }
);

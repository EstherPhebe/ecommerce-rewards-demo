import { z } from "zod";

const eventUser = z.object({
  id: z.string().min(1),
  name: z.string().nullable(),
  createdAt: z.string(),
});

export const orderCompletedPayload = z.object({
  orderId: z.string().min(1),
  userId: z.string().min(1),
  amount: z.number(),
  name: z.string().optional(),
  settled: z.boolean(),
});

export const achievementUnlockedPayload = z.object({
  achievement_name: z.string().min(1),
  user: eventUser,
});

export const badgeUnlockedPayload = z.object({
  badge_name: z.string().min(1),
  user: eventUser,
});

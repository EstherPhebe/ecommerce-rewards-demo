import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

jest.mock("../../prisma/client", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    achievement: { findMany: jest.fn() },
    badge: { findMany: jest.fn() },
  },
}));

import prismaClient from "../../prisma/client";
import { getUserAchievements } from "../controllers/achievementController";
import { ACHIEVEMENT_CATALOG, BADGE_CATALOG } from "../consts/rewards";

// Prisma's generated types are far narrower than what the tests need to feed
// in, so the mocked client is described by hand.
type QueryMock = jest.Mock<(args?: unknown) => Promise<unknown>>;

const prisma = prismaClient as unknown as {
  user: { findUnique: QueryMock };
  achievement: { findMany: QueryMock };
  badge: { findMany: QueryMock };
};

function mockRes() {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };
  return res as unknown as Response & {
    status: jest.Mock<() => Response>;
    json: jest.Mock<() => Response>;
  };
}

const call = (userId: unknown) => {
  const req = { params: { userId } } as unknown as Request;
  const res = mockRes();
  const next = jest.fn() as unknown as NextFunction &
    jest.Mock<(err?: unknown) => void>;
  return { res, next, done: getUserAchievements(req, res, next) };
};

describe("GET /users/:userId/achievements", () => {
  beforeEach(() => {
    prisma.achievement.findMany.mockResolvedValue(ACHIEVEMENT_CATALOG);
    prisma.badge.findMany.mockResolvedValue(BADGE_CATALOG);
  });

  it("returns the summary for a user with unlocks", async () => {
    prisma.user.findUnique.mockResolvedValue({
      achievement: [
        { achievement: { name: "first_purchase" } },
        { achievement: { name: "fifth_purchase" } },
      ],
    });

    const { res, next, done } = call("user-1");
    await done;

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        unlocked_achievements: ["first_purchase", "fifth_purchase"],
        next_available_achievements: ["tenth_purchase"],
        current_badge: "bronze",
        next_badge: "silver",
        remaining_to_unlock_next_badge: 1,
      },
    });
  });

  it("looks the user up by the id in the route params", async () => {
    prisma.user.findUnique.mockResolvedValue({ achievement: [] });

    await call("user-42").done;

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-42" } })
    );
  });

  it("passes a 404 to the error handler for an unknown user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const { res, next, done } = call("nobody");
    await done;

    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "User not found", errorCode: 404 })
    );
  });

  it("rejects a missing user id before touching the database", async () => {
    const { next, done } = call(undefined);
    await done;

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

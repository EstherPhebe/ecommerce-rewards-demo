export interface EventMessage {
  eventId: string; // unique
  type: string;
  occurredAt: string;
  payload: T;
}

export interface OrderCompleted {
  orderId: string;
  userId: string;
  amount: number;
  // Whether the payment is settled (order cannot be refunded).
  settled: boolean;
}

export interface AchievementUnlocked {
  userId: string;
  achievementName: string;
}

export interface BadgeUnlocked {
  userBadgeId: number;
  userId: string;
  badgeName: string;
  cashbackAmount: number;
}

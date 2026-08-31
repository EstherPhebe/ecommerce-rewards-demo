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

export interface EventUser {
  id: string;
  name: string | null;
  createdAt: string;
}

// Fired when a user unlocks an achievement.
export interface AchievementUnlocked {
  achievement_name: string;
  user: EventUser;
}

// Fired when a user earns a new badge.
export interface BadgeUnlocked {
  badge_name: string;
  user: EventUser;
}

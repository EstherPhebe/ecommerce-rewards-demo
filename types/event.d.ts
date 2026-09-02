export interface EventMessage<T> {
  eventId: string; // unique
  type: string;
  occurredAt: string;
  payload: T;
}

export interface OrderCompleted {
  orderId: string;
  userId: string;
  amount: number;
  name?: string; // optional at the producer.
  // Whether the payment is settled (order cannot be refunded).
  settled: boolean;
}

export interface EventUser {
  id: string;
  name: string | null;
  createdAt: string;
}

// User unlocks an achievement.
export interface AchievementUnlocked {
  achievement_name: string;
  user: EventUser;
}

// User earns a new badge.
export interface BadgeUnlocked {
  badge_name: string;
  user: EventUser;
}

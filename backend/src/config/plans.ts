export const PLAN_LIMITS = {
  free: {
    maxRepositories: 3,
    maxMessagesPerDay: 50,
  },
  pro: {
    maxRepositories: 20,
    maxMessagesPerDay: 500,
  },
};

export type PlanType = keyof typeof PLAN_LIMITS;
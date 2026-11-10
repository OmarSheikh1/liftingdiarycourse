// CHG-20261110-001-PLAN-FUTURE-WORKOUT
// Purpose: Business rule for planning workouts: only dates after today can be planned.
import { addDays, startOfDay } from "date-fns";

export class PlanningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanningError";
  }
}

/** First instant that counts as "in the future" (start of tomorrow). */
export function startOfTomorrow(now: Date = new Date()): Date {
  return addDays(startOfDay(now), 1);
}

/** True when `date` falls on a day after today. */
export function isPlannableDate(date: Date, now: Date = new Date()): boolean {
  return startOfDay(date) >= startOfTomorrow(now);
}

// CHG-20261110-002-WORKOUT-NAME
// Purpose: Names (or clears the name of) the user's planned workout on a future date.
import { startOfDay } from "date-fns";
import { isPlannableDate, PlanningError } from "./planning";
import type { WorkoutRepository } from "./workout-repository";

export const MAX_WORKOUT_NAME_LENGTH = 80;

export class RenamePlannedWorkout {
  constructor(private readonly repository: WorkoutRepository) {}

  async execute(userId: string, date: Date, name: string): Promise<void> {
    if (!isPlannableDate(date)) {
      throw new PlanningError("Workouts can only be named for future dates.");
    }
    const trimmed = name.trim();
    if (trimmed.length > MAX_WORKOUT_NAME_LENGTH) {
      throw new PlanningError(
        `Workout name must be at most ${MAX_WORKOUT_NAME_LENGTH} characters.`,
      );
    }
    // An empty name clears the name.
    await this.repository.setWorkoutNameOnDay(
      userId,
      startOfDay(date),
      trimmed === "" ? null : trimmed,
    );
  }
}

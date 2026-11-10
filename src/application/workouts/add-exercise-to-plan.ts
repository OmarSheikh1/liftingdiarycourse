// CHG-20261110-001-PLAN-FUTURE-WORKOUT
// Purpose: Adds an exercise to the user's planned workout on a future date.
import { startOfDay } from "date-fns";
import { isPlannableDate, PlanningError } from "./planning";
import type { WorkoutRepository } from "./workout-repository";

export class AddExerciseToPlan {
  constructor(private readonly repository: WorkoutRepository) {}

  async execute(userId: string, date: Date, exerciseId: number): Promise<void> {
    if (!isPlannableDate(date)) {
      throw new PlanningError("Exercises can only be planned for future dates.");
    }
    await this.repository.addExerciseToWorkoutOnDay(
      userId,
      startOfDay(date),
      exerciseId,
    );
  }
}

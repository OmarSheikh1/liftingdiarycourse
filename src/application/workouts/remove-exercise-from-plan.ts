// CHG-20261110-001-PLAN-FUTURE-WORKOUT
// Purpose: Removes an exercise from a planned (future) workout owned by the user.
import { startOfTomorrow } from "./planning";
import type { WorkoutRepository } from "./workout-repository";

export class RemoveExerciseFromPlan {
  constructor(private readonly repository: WorkoutRepository) {}

  async execute(userId: string, workoutExerciseId: number): Promise<void> {
    // Only workouts from tomorrow onwards are plans; logged workouts stay untouched.
    await this.repository.removeExerciseFromWorkout(
      userId,
      workoutExerciseId,
      startOfTomorrow(),
    );
  }
}

// CHG-20261110-001-PLAN-FUTURE-WORKOUT
// Purpose: Lists exercises the user can add to a workout.
import type { ExerciseDto, ExerciseRepository } from "./exercise-repository";

export class ListAvailableExercises {
  constructor(private readonly repository: ExerciseRepository) {}

  execute(userId: string): Promise<ExerciseDto[]> {
    return this.repository.listAvailableForUser(userId);
  }
}

// CHG-20261110-001-PLAN-FUTURE-WORKOUT
// Purpose: Creates a custom exercise for the user after enforcing name rules.
import { PlanningError } from "@/application/workouts/planning";
import type { ExerciseDto, ExerciseRepository } from "./exercise-repository";

export const MAX_EXERCISE_NAME_LENGTH = 80;

export class CreateCustomExercise {
  constructor(private readonly repository: ExerciseRepository) {}

  execute(userId: string, name: string): Promise<ExerciseDto> {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_EXERCISE_NAME_LENGTH) {
      throw new PlanningError(
        `Exercise name must be 1-${MAX_EXERCISE_NAME_LENGTH} characters.`,
      );
    }
    return this.repository.createCustom(userId, trimmed);
  }
}

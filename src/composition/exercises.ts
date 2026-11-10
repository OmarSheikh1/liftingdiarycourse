// CHG-20261110-001-PLAN-FUTURE-WORKOUT
// Purpose: Wires the exercise use cases to the Drizzle repository.
import "server-only";
import { CreateCustomExercise } from "@/application/exercises/create-custom-exercise";
import { ListAvailableExercises } from "@/application/exercises/list-available-exercises";
import { DrizzleExerciseRepository } from "@/data/exercises/drizzle-exercise-repository";
import { getAuthenticatedUserId } from "@/composition/auth";

export async function listAvailableExercises() {
  const userId = await getAuthenticatedUserId();
  return new ListAvailableExercises(new DrizzleExerciseRepository()).execute(
    userId,
  );
}

export async function createCustomExercise(name: string) {
  const userId = await getAuthenticatedUserId();
  return new CreateCustomExercise(new DrizzleExerciseRepository()).execute(
    userId,
    name,
  );
}

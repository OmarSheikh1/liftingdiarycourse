import "server-only";
import { AddExerciseToPlan } from "@/application/workouts/add-exercise-to-plan";
import { GetWorkoutsForDate } from "@/application/workouts/get-workouts-for-date";
import { RenamePlannedWorkout } from "@/application/workouts/rename-planned-workout";
import { RemoveExerciseFromPlan } from "@/application/workouts/remove-exercise-from-plan";
import { DrizzleWorkoutRepository } from "@/data/workouts/drizzle-workout-repository";
import { getAuthenticatedUserId } from "@/composition/auth";

export async function getWorkoutsForDate(date: Date) {
  const userId = await getAuthenticatedUserId();
  return new GetWorkoutsForDate(new DrizzleWorkoutRepository()).execute(
    userId,
    date,
  );
}

// CHG-20261110-001-PLAN-FUTURE-WORKOUT
// Purpose: Wires the plan add/remove use cases to the Drizzle repository.
export async function addExerciseToPlan(date: Date, exerciseId: number) {
  const userId = await getAuthenticatedUserId();
  return new AddExerciseToPlan(new DrizzleWorkoutRepository()).execute(
    userId,
    date,
    exerciseId,
  );
}

// CHG-20261110-002-WORKOUT-NAME
// Purpose: Wires the rename use case to the Drizzle repository.
export async function renamePlannedWorkout(date: Date, name: string) {
  const userId = await getAuthenticatedUserId();
  return new RenamePlannedWorkout(new DrizzleWorkoutRepository()).execute(
    userId,
    date,
    name,
  );
}

export async function removeExerciseFromPlan(workoutExerciseId: number) {
  const userId = await getAuthenticatedUserId();
  return new RemoveExerciseFromPlan(new DrizzleWorkoutRepository()).execute(
    userId,
    workoutExerciseId,
  );
}

import "server-only";
import { GetWorkoutsForDate } from "@/application/workouts/get-workouts-for-date";
import { DrizzleWorkoutRepository } from "@/data/workouts/drizzle-workout-repository";
import { getAuthenticatedUserId } from "@/composition/auth";

export async function getWorkoutsForDate(date: Date) {
  const userId = await getAuthenticatedUserId();
  return new GetWorkoutsForDate(new DrizzleWorkoutRepository()).execute(
    userId,
    date,
  );
}

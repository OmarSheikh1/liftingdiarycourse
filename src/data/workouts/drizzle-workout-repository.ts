import "server-only";
import { db } from "@/data/db";
import type {
  WorkoutDto,
  WorkoutRepository,
} from "@/application/workouts/workout-repository";

export class DrizzleWorkoutRepository implements WorkoutRepository {
  async findForUserBetween(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<WorkoutDto[]> {
    const rows = await db.query.workouts.findMany({
      where: { userId, startedAt: { gte: from, lt: to } },
      orderBy: { startedAt: "asc" },
      with: { workoutExercises: { with: { sets: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      exerciseCount: row.workoutExercises.length,
      setCount: row.workoutExercises.reduce(
        (total, we) => total + we.sets.length,
        0,
      ),
    }));
  }
}

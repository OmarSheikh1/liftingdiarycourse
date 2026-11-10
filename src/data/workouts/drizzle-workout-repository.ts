import "server-only";
import { and, asc, count, eq, gte, isNull, lt, max, or } from "drizzle-orm";
import { db } from "@/data/db";
import { exercises, workoutExercises, workouts } from "@/data/schema";
import { PlanningError } from "@/application/workouts/planning";
import type {
  WorkoutDto,
  WorkoutRepository,
} from "@/application/workouts/workout-repository";

export class DrizzleWorkoutRepository implements WorkoutRepository {
  // CHG-20261110-001-PLAN-FUTURE-WORKOUT
  // Change: Also load the exercises (name, order) of each workout.
  async findForUserBetween(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<WorkoutDto[]> {
    const rows = await db.query.workouts.findMany({
      where: { userId, startedAt: { gte: from, lt: to } },
      orderBy: { startedAt: "asc" },
      with: {
        workoutExercises: {
          orderBy: { order: "asc" },
          with: { sets: true, exercise: true },
        },
      },
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
      exercises: row.workoutExercises.map((we) => ({
        id: we.id,
        exerciseId: we.exerciseId,
        name: we.exercise.name,
        order: we.order,
      })),
    }));
  }

  // CHG-20261110-001-PLAN-FUTURE-WORKOUT
  // Purpose: Finds or creates the user's workout for the day and appends an exercise.
  // Note: the neon-http driver has no interactive transactions. Network round trips are
  // the dominant cost, so independent reads are sent together in one db.batch() call
  // (1 trip), followed by the insert (1 trip; 2 when the day's workout must be created).
  // The unique (workout_id, order) index guards against concurrent inserts.
  async addExerciseToWorkoutOnDay(
    userId: string,
    dayStart: Date,
    exerciseId: number,
  ): Promise<void> {
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [exerciseRows, workoutRows] = await db.batch([
      // Exercise must be built-in or owned by this user.
      db
        .select({ id: exercises.id })
        .from(exercises)
        .where(
          and(
            eq(exercises.id, exerciseId),
            or(isNull(exercises.userId), eq(exercises.userId, userId)),
          ),
        ),
      // The day's workout (if any) together with its current last position.
      db
        .select({ id: workouts.id, lastOrder: max(workoutExercises.order) })
        .from(workouts)
        .leftJoin(workoutExercises, eq(workoutExercises.workoutId, workouts.id))
        .where(
          and(
            eq(workouts.userId, userId),
            gte(workouts.startedAt, dayStart),
            lt(workouts.startedAt, dayEnd),
          ),
        )
        .groupBy(workouts.id)
        .orderBy(asc(workouts.id))
        .limit(1),
    ]);

    const [exercise] = exerciseRows;
    if (!exercise) throw new PlanningError("Exercise not found.");

    const [existing] = workoutRows;
    let workoutId = existing?.id;
    if (workoutId === undefined) {
      const [created] = await db
        .insert(workouts)
        .values({ userId, startedAt: dayStart })
        .returning({ id: workouts.id });
      workoutId = created.id;
    }

    await db.insert(workoutExercises).values({
      workoutId,
      exerciseId: exercise.id,
      order: (existing?.lastOrder ?? 0) + 1,
    });
  }

  // CHG-20261110-002-WORKOUT-NAME
  // Purpose: Sets or clears the name of the day's workout, creating the workout if needed.
  async setWorkoutNameOnDay(
    userId: string,
    dayStart: Date,
    name: string | null,
  ): Promise<void> {
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [existing] = await db
      .select({ id: workouts.id })
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, userId),
          gte(workouts.startedAt, dayStart),
          lt(workouts.startedAt, dayEnd),
        ),
      )
      .orderBy(asc(workouts.id))
      .limit(1);

    if (existing) {
      await db
        .update(workouts)
        .set({ name })
        .where(and(eq(workouts.id, existing.id), eq(workouts.userId, userId)));
    } else if (name !== null) {
      await db.insert(workouts).values({ userId, startedAt: dayStart, name });
    }
  }

  // CHG-20261110-001-PLAN-FUTURE-WORKOUT
  // Purpose: Ownership-checked removal; drops the workout once it has no exercises.
  // CHG-20261110-002-WORKOUT-NAME
  // Change: A named workout is kept even when it has no exercises left.
  async removeExerciseFromWorkout(
    userId: string,
    workoutExerciseId: number,
    startedFrom: Date,
  ): Promise<void> {
    const [owned] = await db
      .select({
        id: workoutExercises.id,
        workoutId: workoutExercises.workoutId,
        workoutName: workouts.name,
      })
      .from(workoutExercises)
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(
        and(
          eq(workoutExercises.id, workoutExerciseId),
          eq(workouts.userId, userId),
          gte(workouts.startedAt, startedFrom),
        ),
      );
    if (!owned) return;

    // Delete and re-count in one batch (1 trip); statements run in order.
    const [, [remaining]] = await db.batch([
      db.delete(workoutExercises).where(eq(workoutExercises.id, owned.id)),
      db
        .select({ total: count() })
        .from(workoutExercises)
        .where(eq(workoutExercises.workoutId, owned.workoutId)),
    ]);

    if (remaining.total === 0 && owned.workoutName === null) {
      await db
        .delete(workouts)
        .where(
          and(eq(workouts.id, owned.workoutId), eq(workouts.userId, userId)),
        );
    }
  }
}

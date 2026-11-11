// CHG-20261110-003-COACH-PLANS
// Purpose: Drizzle implementation of the CoachPlanRepository port. Every coach-side query
// filters by coachUserId; child rows are checked through their parent plan.
// Note: the neon-http driver has no interactive transactions, so independent reads are
// sent together with db.batch() and unique indexes guard races.
import "server-only";
import { and, eq, gte, inArray, isNull, max, or } from "drizzle-orm";
import { db } from "@/data/db";
import { coachPlanExercises, coachPlans, exercises } from "@/data/schema";
import { PlanningError } from "@/application/workouts/planning";
import type {
  AssignedPlanDto,
  CoachPlanDto,
  CoachPlanExerciseDto,
  CoachPlanRepository,
  CoachPlanSummaryDto,
} from "@/application/coach/coach-plan-repository";
import type { PrescriptionInput } from "@/application/coach/coach-plan-rules";

type ExerciseRow = typeof coachPlanExercises.$inferSelect & {
  exercise: { name: string };
};

function toExerciseDto(row: ExerciseRow): CoachPlanExerciseDto {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    name: row.exercise.name,
    order: row.order,
    sets: row.sets,
    reps: row.reps,
    repsMax: row.repsMax,
    restSeconds: row.restSeconds,
    weight: row.weight === null ? null : Number(row.weight),
    notes: row.notes,
  };
}

function toColumns(p: PrescriptionInput) {
  return {
    sets: p.sets,
    reps: p.reps,
    repsMax: p.repsMax,
    restSeconds: p.restSeconds,
    weight: p.weight === null ? null : p.weight.toFixed(2),
    notes: p.notes,
  };
}

/** Ids of the coach's plans that are still editable (user-scoped subquery). */
function editablePlanIds(coachUserId: string, earliestEditableDate: string) {
  return db
    .select({ id: coachPlans.id })
    .from(coachPlans)
    .where(
      and(
        eq(coachPlans.coachUserId, coachUserId),
        gte(coachPlans.planDate, earliestEditableDate),
      ),
    );
}

export class DrizzleCoachPlanRepository implements CoachPlanRepository {
  async createPlan(
    coachUserId: string,
    coachEmail: string,
    memberEmail: string,
    planDate: string,
    name: string | null,
  ): Promise<{ id: number }> {
    const [created] = await db
      .insert(coachPlans)
      .values({ coachUserId, coachEmail, memberEmail, planDate, name })
      .onConflictDoNothing({
        target: [
          coachPlans.coachUserId,
          coachPlans.memberEmail,
          coachPlans.planDate,
        ],
      })
      .returning({ id: coachPlans.id });
    if (!created) {
      throw new PlanningError(
        "You already have a plan for this member on this date.",
      );
    }
    return created;
  }

  async addExercise(
    coachUserId: string,
    planId: number,
    exerciseId: number,
    prescription: PrescriptionInput,
    earliestEditableDate: string,
  ): Promise<boolean> {
    const [planRows, exerciseRows, orderRows] = await db.batch([
      db
        .select({ id: coachPlans.id })
        .from(coachPlans)
        .where(
          and(
            eq(coachPlans.id, planId),
            eq(coachPlans.coachUserId, coachUserId),
            gte(coachPlans.planDate, earliestEditableDate),
          ),
        ),
      // Exercise must be built-in or owned by this coach.
      db
        .select({ id: exercises.id })
        .from(exercises)
        .where(
          and(
            eq(exercises.id, exerciseId),
            or(isNull(exercises.userId), eq(exercises.userId, coachUserId)),
          ),
        ),
      db
        .select({ lastOrder: max(coachPlanExercises.order) })
        .from(coachPlanExercises)
        .where(eq(coachPlanExercises.coachPlanId, planId)),
    ]);

    if (planRows.length === 0) return false;
    if (exerciseRows.length === 0) throw new PlanningError("Exercise not found.");

    await db.insert(coachPlanExercises).values({
      coachPlanId: planId,
      exerciseId,
      order: (orderRows[0]?.lastOrder ?? 0) + 1,
      ...toColumns(prescription),
    });
    return true;
  }

  async updateExercise(
    coachUserId: string,
    planExerciseId: number,
    prescription: PrescriptionInput,
    earliestEditableDate: string,
  ): Promise<boolean> {
    const updated = await db
      .update(coachPlanExercises)
      .set(toColumns(prescription))
      .where(
        and(
          eq(coachPlanExercises.id, planExerciseId),
          inArray(
            coachPlanExercises.coachPlanId,
            editablePlanIds(coachUserId, earliestEditableDate),
          ),
        ),
      )
      .returning({ id: coachPlanExercises.id });
    return updated.length > 0;
  }

  async removeExercise(
    coachUserId: string,
    planExerciseId: number,
    earliestEditableDate: string,
  ): Promise<boolean> {
    const removed = await db
      .delete(coachPlanExercises)
      .where(
        and(
          eq(coachPlanExercises.id, planExerciseId),
          inArray(
            coachPlanExercises.coachPlanId,
            editablePlanIds(coachUserId, earliestEditableDate),
          ),
        ),
      )
      .returning({ id: coachPlanExercises.id });
    return removed.length > 0;
  }

  async setName(
    coachUserId: string,
    planId: number,
    name: string | null,
    earliestEditableDate: string,
  ): Promise<boolean> {
    const updated = await db
      .update(coachPlans)
      .set({ name })
      .where(
        and(
          eq(coachPlans.id, planId),
          eq(coachPlans.coachUserId, coachUserId),
          gte(coachPlans.planDate, earliestEditableDate),
        ),
      )
      .returning({ id: coachPlans.id });
    return updated.length > 0;
  }

  async deletePlan(
    coachUserId: string,
    planId: number,
    earliestEditableDate: string,
  ): Promise<boolean> {
    // Exercises are removed by the ON DELETE CASCADE foreign key.
    const deleted = await db
      .delete(coachPlans)
      .where(
        and(
          eq(coachPlans.id, planId),
          eq(coachPlans.coachUserId, coachUserId),
          gte(coachPlans.planDate, earliestEditableDate),
        ),
      )
      .returning({ id: coachPlans.id });
    return deleted.length > 0;
  }

  async listForCoach(coachUserId: string): Promise<CoachPlanSummaryDto[]> {
    const rows = await db.query.coachPlans.findMany({
      where: { coachUserId },
      orderBy: { planDate: "desc", id: "desc" },
      with: { exercises: { columns: { id: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      memberEmail: row.memberEmail,
      planDate: row.planDate,
      name: row.name,
      exerciseCount: row.exercises.length,
    }));
  }

  async findByIdForCoach(
    coachUserId: string,
    planId: number,
  ): Promise<CoachPlanDto | null> {
    const row = await db.query.coachPlans.findFirst({
      where: { id: planId, coachUserId },
      with: {
        exercises: { orderBy: { order: "asc" }, with: { exercise: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      memberEmail: row.memberEmail,
      planDate: row.planDate,
      name: row.name,
      exercises: row.exercises.map(toExerciseDto),
    };
  }

  async findAssignedToEmailOnDate(
    memberEmail: string,
    planDate: string,
  ): Promise<AssignedPlanDto[]> {
    const rows = await db.query.coachPlans.findMany({
      where: { memberEmail, planDate },
      orderBy: { id: "asc" },
      with: {
        exercises: { orderBy: { order: "asc" }, with: { exercise: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      coachEmail: row.coachEmail,
      planDate: row.planDate,
      name: row.name,
      exercises: row.exercises.map(toExerciseDto),
    }));
  }
}

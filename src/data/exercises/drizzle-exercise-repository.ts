// CHG-20261110-001-PLAN-FUTURE-WORKOUT
// Purpose: Drizzle implementation of the ExerciseRepository port.
import "server-only";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/data/db";
import { exercises } from "@/data/schema";
import type {
  ExerciseDto,
  ExerciseRepository,
} from "@/application/exercises/exercise-repository";

type ExerciseRow = typeof exercises.$inferSelect;

function toDto(row: ExerciseRow): ExerciseDto {
  return { id: row.id, name: row.name, isCustom: row.userId !== null };
}

export class DrizzleExerciseRepository implements ExerciseRepository {
  async listAvailableForUser(userId: string): Promise<ExerciseDto[]> {
    const rows = await db
      .select()
      .from(exercises)
      .where(or(isNull(exercises.userId), eq(exercises.userId, userId)))
      .orderBy(asc(exercises.name));
    return rows.map(toDto);
  }

  async createCustom(userId: string, name: string): Promise<ExerciseDto> {
    const [existing] = await db
      .select()
      .from(exercises)
      .where(
        and(
          eq(exercises.name, name),
          or(isNull(exercises.userId), eq(exercises.userId, userId)),
        ),
      );
    if (existing) return toDto(existing);

    const [created] = await db
      .insert(exercises)
      .values({ userId, name })
      .returning();
    return toDto(created);
  }
}

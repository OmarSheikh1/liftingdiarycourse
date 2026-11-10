// CHG-20261110-001-PLAN-FUTURE-WORKOUT
// Purpose: Server Actions for planning exercises on future dates. Input is validated
// with Zod; authentication and ownership are enforced in composition/use cases.
"use server";

import { isValid, parse } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PlanningError } from "@/application/workouts/planning";
import { createCustomExercise } from "@/composition/exercises";
import {
  addExerciseToPlan,
  removeExerciseFromPlan,
  renamePlannedWorkout,
} from "@/composition/workouts";

export type ActionResult = { ok: true } | { ok: false; error: string };

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((value) => parse(value, "yyyy-MM-dd", new Date()))
  .refine(isValid, "Invalid date");

const addSchema = z.object({
  date: dateSchema,
  exerciseId: z.number().int().positive(),
});

const createAndAddSchema = z.object({
  date: dateSchema,
  name: z.string().trim().min(1).max(80),
});

// CHG-20261110-002-WORKOUT-NAME
const renameSchema = z.object({
  date: dateSchema,
  name: z.string().trim().max(80),
});

const removeSchema = z.object({
  workoutExerciseId: z.number().int().positive(),
});

async function run(action: () => Promise<void>): Promise<ActionResult> {
  try {
    await action();
  } catch (error) {
    if (error instanceof PlanningError) {
      return { ok: false, error: error.message };
    }
    // Anything else (including framework redirects for unauthenticated users) propagates.
    throw error;
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addExerciseAction(input: {
  date: string;
  exerciseId: number;
}): Promise<ActionResult> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  return run(() => addExerciseToPlan(parsed.data.date, parsed.data.exerciseId));
}

export async function createAndAddExerciseAction(input: {
  date: string;
  name: string;
}): Promise<ActionResult> {
  const parsed = createAndAddSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Exercise name must be 1-80 characters." };
  }
  return run(async () => {
    const exercise = await createCustomExercise(parsed.data.name);
    await addExerciseToPlan(parsed.data.date, exercise.id);
  });
}

// CHG-20261110-002-WORKOUT-NAME
// Purpose: Saves (or clears, when empty) the name of the planned workout.
export async function renameWorkoutAction(input: {
  date: string;
  name: string;
}): Promise<ActionResult> {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Workout name must be at most 80 characters." };
  }
  return run(() => renamePlannedWorkout(parsed.data.date, parsed.data.name));
}

export async function removeExerciseAction(input: {
  workoutExerciseId: number;
}): Promise<ActionResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  return run(() => removeExerciseFromPlan(parsed.data.workoutExerciseId));
}

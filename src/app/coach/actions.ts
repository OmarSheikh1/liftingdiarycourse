// CHG-20261110-003-COACH-PLANS
// Purpose: Server Actions for coach plans. Input is validated with Zod; authentication
// and ownership are enforced in composition, use cases and the repository.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PlanningError } from "@/application/coach/coach-plan-rules";
import {
  addExerciseToCoachPlan,
  createCoachPlan,
  deleteCoachPlan,
  removeCoachPlanExercise,
  renameCoachPlan,
  updateCoachPlanExercise,
} from "@/composition/coach";
import { createCustomExercise } from "@/composition/exercises";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreatePlanResult =
  | { ok: true; planId: number }
  | { ok: false; error: string };

const idSchema = z.number().int().positive();
const nameSchema = z.string().trim().max(80);

const prescriptionShape = {
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(100),
  repsMax: z.number().int().min(1).max(100).nullable(),
  restSeconds: z.number().int().min(0).max(1800).nullable(),
  weight: z
    .number()
    .min(0)
    .max(1000)
    .multipleOf(0.01)
    .nullable(),
  notes: z.string().trim().max(280).nullable(),
};

// repsMax, when set, must be at least reps.
function repsRangeValid(v: { reps: number; repsMax: number | null }) {
  return v.repsMax === null || v.repsMax >= v.reps;
}
const repsRangeMessage = { message: "Max reps must be at least reps." };

const createSchema = z.object({
  memberEmail: z.string().trim().toLowerCase().min(3).max(254),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: nameSchema,
});

const addSchema = z
  .object({ planId: idSchema, exerciseId: idSchema, ...prescriptionShape })
  .refine(repsRangeValid, repsRangeMessage);

const createAndAddSchema = z
  .object({
    planId: idSchema,
    exerciseName: z.string().trim().min(1).max(80),
    ...prescriptionShape,
  })
  .refine(repsRangeValid, repsRangeMessage);

const updateSchema = z
  .object({ planExerciseId: idSchema, ...prescriptionShape })
  .refine(repsRangeValid, repsRangeMessage);

const removeSchema = z.object({ planExerciseId: idSchema });
const renameSchema = z.object({ planId: idSchema, name: nameSchema });
const deleteSchema = z.object({ planId: idSchema });

type PrescriptionFields = {
  sets: number;
  reps: number;
  repsMax: number | null;
  restSeconds: number | null;
  weight: number | null;
  notes: string | null;
};

function prescriptionOf(v: PrescriptionFields): PrescriptionFields {
  return {
    sets: v.sets,
    reps: v.reps,
    repsMax: v.repsMax,
    restSeconds: v.restSeconds,
    weight: v.weight,
    notes: v.notes,
  };
}

function revalidateCoachPaths() {
  revalidatePath("/coach");
  revalidatePath("/coach/[planId]", "page");
  revalidatePath("/dashboard");
}

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
  revalidateCoachPaths();
  return { ok: true };
}

export async function createCoachPlanAction(input: {
  memberEmail: string;
  date: string;
  name: string;
}): Promise<CreatePlanResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the email, date and name." };
  try {
    const { id } = await createCoachPlan({
      memberEmail: parsed.data.memberEmail,
      date: parsed.data.date,
      name: parsed.data.name,
    });
    revalidateCoachPaths();
    return { ok: true, planId: id };
  } catch (error) {
    if (error instanceof PlanningError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function addPlanExerciseAction(input: {
  planId: number;
  exerciseId: number;
  sets: number;
  reps: number;
  repsMax: number | null;
  restSeconds: number | null;
  weight: number | null;
  notes: string | null;
}): Promise<ActionResult> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the exercise values." };
  const { planId, exerciseId } = parsed.data;
  return run(() =>
    addExerciseToCoachPlan(planId, exerciseId, prescriptionOf(parsed.data)),
  );
}

export async function createAndAddPlanExerciseAction(input: {
  planId: number;
  exerciseName: string;
  sets: number;
  reps: number;
  repsMax: number | null;
  restSeconds: number | null;
  weight: number | null;
  notes: string | null;
}): Promise<ActionResult> {
  const parsed = createAndAddSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the exercise values." };
  return run(async () => {
    const exercise = await createCustomExercise(parsed.data.exerciseName);
    await addExerciseToCoachPlan(
      parsed.data.planId,
      exercise.id,
      prescriptionOf(parsed.data),
    );
  });
}

export async function updatePlanExerciseAction(input: {
  planExerciseId: number;
  sets: number;
  reps: number;
  repsMax: number | null;
  restSeconds: number | null;
  weight: number | null;
  notes: string | null;
}): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the exercise values." };
  return run(() =>
    updateCoachPlanExercise(
      parsed.data.planExerciseId,
      prescriptionOf(parsed.data),
    ),
  );
}

export async function removePlanExerciseAction(input: {
  planExerciseId: number;
}): Promise<ActionResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  return run(() => removeCoachPlanExercise(parsed.data.planExerciseId));
}

export async function renameCoachPlanAction(input: {
  planId: number;
  name: string;
}): Promise<ActionResult> {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Plan name must be at most 80 characters." };
  }
  return run(() =>
    renameCoachPlan(parsed.data.planId, parsed.data.name || null),
  );
}

export async function deleteCoachPlanAction(input: {
  planId: number;
}): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  return run(() => deleteCoachPlan(parsed.data.planId));
}

// CHG-20261110-003-COACH-PLANS
// Purpose: Wires the coach-plan use cases to the Drizzle repository and resolves the
// verified user (id and email). The only place that knows both sides.
import "server-only";
import { AddExerciseToCoachPlan } from "@/application/coach/add-exercise-to-coach-plan";
import type { PrescriptionInput } from "@/application/coach/coach-plan-rules";
import { PlanningError } from "@/application/coach/coach-plan-rules";
import { CreateCoachPlan } from "@/application/coach/create-coach-plan";
import { DeleteCoachPlan } from "@/application/coach/delete-coach-plan";
import { GetAssignedPlansForDate } from "@/application/coach/get-assigned-plans-for-date";
import { GetCoachPlan } from "@/application/coach/get-coach-plan";
import { ListCoachPlans } from "@/application/coach/list-coach-plans";
import { RemoveCoachPlanExercise } from "@/application/coach/remove-coach-plan-exercise";
import { RenameCoachPlan } from "@/application/coach/rename-coach-plan";
import { UpdateCoachPlanExercise } from "@/application/coach/update-coach-plan-exercise";
import {
  getAuthenticatedUserEmail,
  getAuthenticatedUserId,
} from "@/composition/auth";
import { DrizzleCoachPlanRepository } from "@/data/coach/drizzle-coach-plan-repository";

export async function createCoachPlan(input: {
  memberEmail: string;
  date: string;
  name: string | null;
}) {
  const userId = await getAuthenticatedUserId();
  const coachEmail = await getAuthenticatedUserEmail();
  if (!coachEmail) {
    throw new PlanningError("Verify your email address to create plans.");
  }
  return new CreateCoachPlan(new DrizzleCoachPlanRepository()).execute(
    userId,
    coachEmail,
    input,
  );
}

export async function listCoachPlans() {
  const userId = await getAuthenticatedUserId();
  return new ListCoachPlans(new DrizzleCoachPlanRepository()).execute(userId);
}

export async function getCoachPlan(planId: number) {
  const userId = await getAuthenticatedUserId();
  return new GetCoachPlan(new DrizzleCoachPlanRepository()).execute(
    userId,
    planId,
  );
}

export async function addExerciseToCoachPlan(
  planId: number,
  exerciseId: number,
  prescription: PrescriptionInput,
) {
  const userId = await getAuthenticatedUserId();
  return new AddExerciseToCoachPlan(new DrizzleCoachPlanRepository()).execute(
    userId,
    planId,
    exerciseId,
    prescription,
  );
}

export async function updateCoachPlanExercise(
  planExerciseId: number,
  prescription: PrescriptionInput,
) {
  const userId = await getAuthenticatedUserId();
  return new UpdateCoachPlanExercise(
    new DrizzleCoachPlanRepository(),
  ).execute(userId, planExerciseId, prescription);
}

export async function removeCoachPlanExercise(planExerciseId: number) {
  const userId = await getAuthenticatedUserId();
  return new RemoveCoachPlanExercise(
    new DrizzleCoachPlanRepository(),
  ).execute(userId, planExerciseId);
}

export async function renameCoachPlan(planId: number, name: string | null) {
  const userId = await getAuthenticatedUserId();
  return new RenameCoachPlan(new DrizzleCoachPlanRepository()).execute(
    userId,
    planId,
    name,
  );
}

export async function deleteCoachPlan(planId: number) {
  const userId = await getAuthenticatedUserId();
  return new DeleteCoachPlan(new DrizzleCoachPlanRepository()).execute(
    userId,
    planId,
  );
}

export async function getAssignedPlansForDate(date: Date) {
  const email = await getAuthenticatedUserEmail();
  return new GetAssignedPlansForDate(new DrizzleCoachPlanRepository()).execute(
    email,
    date,
  );
}

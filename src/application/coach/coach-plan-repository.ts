// CHG-20261110-003-COACH-PLANS
// Purpose: Port (and DTOs) for coach plans. Owned by the Application layer.
import type { PrescriptionInput } from "./coach-plan-rules";

export interface CoachPlanExerciseDto extends PrescriptionInput {
  /** Id of the coach_plan_exercise row. */
  id: number;
  exerciseId: number;
  name: string;
  order: number;
}

export interface CoachPlanSummaryDto {
  id: number;
  memberEmail: string;
  /** yyyy-MM-dd */
  planDate: string;
  name: string | null;
  exerciseCount: number;
}

export interface CoachPlanDto {
  id: number;
  memberEmail: string;
  /** yyyy-MM-dd */
  planDate: string;
  name: string | null;
  exercises: CoachPlanExerciseDto[];
}

/** A plan as seen by the member it is addressed to. Never exposes the coach's user id. */
export interface AssignedPlanDto {
  id: number;
  coachEmail: string;
  /** yyyy-MM-dd */
  planDate: string;
  name: string | null;
  exercises: CoachPlanExerciseDto[];
}

/**
 * Contract for all methods that take `coachUserId`: they only ever touch rows owned by
 * that coach. Child rows are checked through their parent plan.
 *
 * Methods taking `earliestEditableDate` (yyyy-MM-dd) only affect plans whose date is on
 * or after it, and return `false` (a no-op) when the plan or row is not owned by the
 * coach or is no longer editable. They never reveal whether a foreign id exists.
 */
export interface CoachPlanRepository {
  /**
   * Creates a plan. Throws `PlanningError` when the coach already has a plan for the
   * same member email and date.
   */
  createPlan(
    coachUserId: string,
    coachEmail: string,
    memberEmail: string,
    planDate: string,
    name: string | null,
  ): Promise<{ id: number }>;

  /** Appends an exercise. Throws `PlanningError` if the exercise is not available to the coach. */
  addExercise(
    coachUserId: string,
    planId: number,
    exerciseId: number,
    prescription: PrescriptionInput,
    earliestEditableDate: string,
  ): Promise<boolean>;

  updateExercise(
    coachUserId: string,
    planExerciseId: number,
    prescription: PrescriptionInput,
    earliestEditableDate: string,
  ): Promise<boolean>;

  removeExercise(
    coachUserId: string,
    planExerciseId: number,
    earliestEditableDate: string,
  ): Promise<boolean>;

  setName(
    coachUserId: string,
    planId: number,
    name: string | null,
    earliestEditableDate: string,
  ): Promise<boolean>;

  /** Deletes the plan and its exercises. */
  deletePlan(
    coachUserId: string,
    planId: number,
    earliestEditableDate: string,
  ): Promise<boolean>;

  /** Plans created by the coach, newest plan date first. */
  listForCoach(coachUserId: string): Promise<CoachPlanSummaryDto[]>;

  /** The coach's plan with exercises in order, or null when not owned. */
  findByIdForCoach(
    coachUserId: string,
    planId: number,
  ): Promise<CoachPlanDto | null>;

  /** Plans addressed to `memberEmail` (already normalised) on `planDate` (yyyy-MM-dd). */
  findAssignedToEmailOnDate(
    memberEmail: string,
    planDate: string,
  ): Promise<AssignedPlanDto[]>;
}

/** Narrow port for the member-side read (ISP). */
export type AssignedPlanReader = Pick<
  CoachPlanRepository,
  "findAssignedToEmailOnDate"
>;

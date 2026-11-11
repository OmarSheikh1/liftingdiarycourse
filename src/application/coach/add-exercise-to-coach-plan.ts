// CHG-20261110-003-COACH-PLANS
// Purpose: Adds a prescribed exercise to one of the coach's future plans.
import type { CoachPlanRepository } from "./coach-plan-repository";
import {
  earliestEditableDate,
  PlanningError,
  validatePrescription,
  type PrescriptionInput,
} from "./coach-plan-rules";

export class AddExerciseToCoachPlan {
  constructor(
    private readonly repository: Pick<CoachPlanRepository, "addExercise">,
  ) {}

  async execute(
    coachUserId: string,
    planId: number,
    exerciseId: number,
    prescription: PrescriptionInput,
  ): Promise<void> {
    const added = await this.repository.addExercise(
      coachUserId,
      planId,
      exerciseId,
      validatePrescription(prescription),
      earliestEditableDate(),
    );
    if (!added) {
      throw new PlanningError("Plan not found or it can no longer be edited.");
    }
  }
}

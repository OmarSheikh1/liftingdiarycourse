// CHG-20261110-003-COACH-PLANS
// Purpose: Updates the prescription of an exercise in one of the coach's future plans.
import type { CoachPlanRepository } from "./coach-plan-repository";
import {
  earliestEditableDate,
  validatePrescription,
  type PrescriptionInput,
} from "./coach-plan-rules";

export class UpdateCoachPlanExercise {
  constructor(
    private readonly repository: Pick<CoachPlanRepository, "updateExercise">,
  ) {}

  async execute(
    coachUserId: string,
    planExerciseId: number,
    prescription: PrescriptionInput,
  ): Promise<void> {
    // Not-owned or no-longer-editable rows are a silent no-op (no id leak).
    await this.repository.updateExercise(
      coachUserId,
      planExerciseId,
      validatePrescription(prescription),
      earliestEditableDate(),
    );
  }
}

// CHG-20261110-003-COACH-PLANS
// Purpose: Removes an exercise from one of the coach's future plans.
import type { CoachPlanRepository } from "./coach-plan-repository";
import { earliestEditableDate } from "./coach-plan-rules";

export class RemoveCoachPlanExercise {
  constructor(
    private readonly repository: Pick<CoachPlanRepository, "removeExercise">,
  ) {}

  async execute(coachUserId: string, planExerciseId: number): Promise<void> {
    await this.repository.removeExercise(
      coachUserId,
      planExerciseId,
      earliestEditableDate(),
    );
  }
}

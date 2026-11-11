// CHG-20261110-003-COACH-PLANS
// Purpose: Deletes one of the coach's future plans.
import type { CoachPlanRepository } from "./coach-plan-repository";
import { earliestEditableDate } from "./coach-plan-rules";

export class DeleteCoachPlan {
  constructor(
    private readonly repository: Pick<CoachPlanRepository, "deletePlan">,
  ) {}

  async execute(coachUserId: string, planId: number): Promise<void> {
    await this.repository.deletePlan(
      coachUserId,
      planId,
      earliestEditableDate(),
    );
  }
}

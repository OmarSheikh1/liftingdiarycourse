// CHG-20261110-003-COACH-PLANS
// Purpose: Sets or clears the name of one of the coach's future plans.
import type { CoachPlanRepository } from "./coach-plan-repository";
import { earliestEditableDate, normalizePlanName } from "./coach-plan-rules";

export class RenameCoachPlan {
  constructor(
    private readonly repository: Pick<CoachPlanRepository, "setName">,
  ) {}

  async execute(
    coachUserId: string,
    planId: number,
    name: string | null,
  ): Promise<void> {
    await this.repository.setName(
      coachUserId,
      planId,
      normalizePlanName(name),
      earliestEditableDate(),
    );
  }
}

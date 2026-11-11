// CHG-20261110-003-COACH-PLANS
// Purpose: Creates a plan for a member email on a future date.
import type { CoachPlanRepository } from "./coach-plan-repository";
import {
  assertFuturePlanDate,
  normalizeEmail,
  normalizePlanName,
} from "./coach-plan-rules";

export class CreateCoachPlan {
  constructor(
    private readonly repository: Pick<CoachPlanRepository, "createPlan">,
  ) {}

  execute(
    coachUserId: string,
    coachEmail: string,
    input: { memberEmail: string; date: string; name: string | null },
  ): Promise<{ id: number }> {
    return this.repository.createPlan(
      coachUserId,
      coachEmail,
      normalizeEmail(input.memberEmail),
      assertFuturePlanDate(input.date),
      normalizePlanName(input.name),
    );
  }
}

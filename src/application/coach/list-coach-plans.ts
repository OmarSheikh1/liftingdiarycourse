// CHG-20261110-003-COACH-PLANS
// Purpose: Lists the plans the coach created.
import type {
  CoachPlanRepository,
  CoachPlanSummaryDto,
} from "./coach-plan-repository";

export class ListCoachPlans {
  constructor(
    private readonly repository: Pick<CoachPlanRepository, "listForCoach">,
  ) {}

  execute(coachUserId: string): Promise<CoachPlanSummaryDto[]> {
    return this.repository.listForCoach(coachUserId);
  }
}

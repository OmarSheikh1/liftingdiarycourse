// CHG-20261110-003-COACH-PLANS
// Purpose: Loads one of the coach's plans (null when not owned).
import type {
  CoachPlanDto,
  CoachPlanRepository,
} from "./coach-plan-repository";

export class GetCoachPlan {
  constructor(
    private readonly repository: Pick<CoachPlanRepository, "findByIdForCoach">,
  ) {}

  execute(coachUserId: string, planId: number): Promise<CoachPlanDto | null> {
    return this.repository.findByIdForCoach(coachUserId, planId);
  }
}

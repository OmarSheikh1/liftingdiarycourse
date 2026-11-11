// CHG-20261110-003-COACH-PLANS
// Purpose: Plans assigned to the viewer (matched by verified email) on a date.
import { format } from "date-fns";
import type {
  AssignedPlanDto,
  AssignedPlanReader,
} from "./coach-plan-repository";
import { PLAN_DATE_FORMAT } from "./coach-plan-rules";

export class GetAssignedPlansForDate {
  constructor(private readonly repository: AssignedPlanReader) {}

  /** `viewerEmail` is the verified email, or null (then nothing is assigned). */
  async execute(
    viewerEmail: string | null,
    date: Date,
  ): Promise<AssignedPlanDto[]> {
    if (!viewerEmail) return [];
    return this.repository.findAssignedToEmailOnDate(
      viewerEmail.trim().toLowerCase(),
      format(date, PLAN_DATE_FORMAT),
    );
  }
}

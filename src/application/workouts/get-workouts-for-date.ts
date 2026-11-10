import { addDays, startOfDay } from "date-fns";
import type { WorkoutDto, WorkoutRepository } from "./workout-repository";

export class GetWorkoutsForDate {
  constructor(private readonly repository: WorkoutRepository) {}

  execute(userId: string, date: Date): Promise<WorkoutDto[]> {
    const from = startOfDay(date);
    return this.repository.findForUserBetween(userId, from, addDays(from, 1));
  }
}

export interface WorkoutDto {
  id: number;
  name: string | null;
  startedAt: Date;
  completedAt: Date | null;
  exerciseCount: number;
  setCount: number;
}

export interface WorkoutRepository {
  /** Workouts owned by `userId` that started in [from, to). */
  findForUserBetween(userId: string, from: Date, to: Date): Promise<WorkoutDto[]>;
}

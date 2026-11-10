// CHG-20261110-001-PLAN-FUTURE-WORKOUT
// Purpose: Port for the exercise catalog (built-in + the user's custom exercises).
export interface ExerciseDto {
  id: number;
  name: string;
  isCustom: boolean;
}

export interface ExerciseRepository {
  /** Built-in exercises plus those owned by `userId`, sorted by name. */
  listAvailableForUser(userId: string): Promise<ExerciseDto[]>;

  /**
   * Creates a custom exercise for `userId`. If an available exercise with the same
   * name already exists, returns it instead of creating a duplicate.
   */
  createCustom(userId: string, name: string): Promise<ExerciseDto>;
}

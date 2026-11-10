// CHG-20261110-001-PLAN-FUTURE-WORKOUT
// Change: Added PlannedExerciseDto, WorkoutDto.exercises, and the plan add/remove port methods.
export interface PlannedExerciseDto {
  /** Id of the workout_exercise row (the exercise within this workout). */
  id: number;
  exerciseId: number;
  name: string;
  order: number;
}

export interface WorkoutDto {
  id: number;
  name: string | null;
  startedAt: Date;
  completedAt: Date | null;
  exerciseCount: number;
  setCount: number;
  exercises: PlannedExerciseDto[];
}

export interface WorkoutRepository {
  /** Workouts owned by `userId` that started in [from, to). */
  findForUserBetween(userId: string, from: Date, to: Date): Promise<WorkoutDto[]>;

  /**
   * Appends an exercise to the user's workout on the day starting at `dayStart`,
   * creating that workout if needed. Throws if the exercise is not available to the user.
   */
  addExerciseToWorkoutOnDay(
    userId: string,
    dayStart: Date,
    exerciseId: number,
  ): Promise<void>;

  /**
   * Sets (or clears, with null) the name of the user's workout on the day starting at
   * `dayStart`, creating that workout if needed.
   */
  setWorkoutNameOnDay(
    userId: string,
    dayStart: Date,
    name: string | null,
  ): Promise<void>;

  /**
   * Removes an exercise from a workout owned by `userId` that starts at or after
   * `startedFrom`. Deletes the workout if it becomes empty and unnamed. No-op if not found.
   */
  removeExerciseFromWorkout(
    userId: string,
    workoutExerciseId: number,
    startedFrom: Date,
  ): Promise<void>;
}

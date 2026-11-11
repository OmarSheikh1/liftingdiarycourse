import { defineRelations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const exercises = pgTable(
  "exercises",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    // Clerk user id. NULL = built-in exercise, set = that user's custom exercise.
    userId: text("user_id"),
    name: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("exercises_user_name_uq").on(t.userId, t.name),
    // A plain unique index treats NULLs as distinct, so guard built-ins separately.
    uniqueIndex("exercises_builtin_name_uq")
      .on(t.name)
      .where(sql`${t.userId} is null`),
  ],
);

export const workouts = pgTable(
  "workouts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id").notNull(),
    name: text(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // NULL while the workout is in progress.
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("workouts_user_started_idx").on(t.userId, t.startedAt.desc())],
);

export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    workoutId: integer("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    // Position within the workout.
    order: integer("order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("workout_exercises_workout_order_uq").on(t.workoutId, t.order),
    index("workout_exercises_exercise_idx").on(t.exerciseId),
  ],
);

export const sets = pgTable(
  "sets",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    workoutExerciseId: integer("workout_exercise_id")
      .notNull()
      .references(() => workoutExercises.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(),
    reps: integer().notNull(),
    // kg; NULL for bodyweight.
    weight: numeric({ precision: 7, scale: 2 }),
    isWarmup: boolean("is_warmup").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("sets_workout_exercise_set_uq").on(
      t.workoutExerciseId,
      t.setNumber,
    ),
    check("sets_reps_positive", sql`${t.reps} > 0`),
    check("sets_weight_nonneg", sql`${t.weight} >= 0`),
  ],
);

// CHG-20261110-003-COACH-PLANS
// Purpose: Plans a coach (owner) assigns to a member, addressed by email.
export const coachPlans = pgTable(
  "coach_plans",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    // Clerk id of the coach (owner of the row).
    coachUserId: text("coach_user_id").notNull(),
    // Snapshot of the coach's email, shown to the member.
    coachEmail: text("coach_email").notNull(),
    // Lowercase, trimmed email of the member the plan is addressed to.
    memberEmail: text("member_email").notNull(),
    // Calendar day (yyyy-MM-dd), no timezone.
    planDate: date("plan_date", { mode: "string" }).notNull(),
    name: text(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("coach_plans_coach_member_date_uq").on(
      t.coachUserId,
      t.memberEmail,
      t.planDate,
    ),
    index("coach_plans_member_date_idx").on(t.memberEmail, t.planDate),
    index("coach_plans_coach_date_idx").on(t.coachUserId, t.planDate),
  ],
);

export const coachPlanExercises = pgTable(
  "coach_plan_exercises",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    coachPlanId: integer("coach_plan_id")
      .notNull()
      .references(() => coachPlans.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    order: integer("order").notNull(),
    sets: integer().notNull(),
    // Lower (or only) rep target.
    reps: integer().notNull(),
    // Upper end of a rep range, e.g. 8-12.
    repsMax: integer("reps_max"),
    restSeconds: integer("rest_seconds"),
    // kg; NULL when not prescribed.
    weight: numeric({ precision: 7, scale: 2 }),
    notes: text(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("coach_plan_exercises_plan_order_uq").on(
      t.coachPlanId,
      t.order,
    ),
    index("coach_plan_exercises_exercise_idx").on(t.exerciseId),
    check("coach_plan_exercises_sets_positive", sql`${t.sets} > 0`),
    check("coach_plan_exercises_reps_positive", sql`${t.reps} > 0`),
    check(
      "coach_plan_exercises_reps_max_gte",
      sql`${t.repsMax} is null or ${t.repsMax} >= ${t.reps}`,
    ),
    check(
      "coach_plan_exercises_rest_range",
      sql`${t.restSeconds} is null or (${t.restSeconds} >= 0 and ${t.restSeconds} <= 1800)`,
    ),
    check("coach_plan_exercises_weight_nonneg", sql`${t.weight} >= 0`),
  ],
);

export const relations = defineRelations(
  { exercises, workouts, workoutExercises, sets, coachPlans, coachPlanExercises },
  (r) => ({
    workouts: {
      workoutExercises: r.many.workoutExercises({
        from: r.workouts.id,
        to: r.workoutExercises.workoutId,
      }),
    },
    workoutExercises: {
      workout: r.one.workouts({
        from: r.workoutExercises.workoutId,
        to: r.workouts.id,
        optional: false,
      }),
      exercise: r.one.exercises({
        from: r.workoutExercises.exerciseId,
        to: r.exercises.id,
        optional: false,
      }),
      sets: r.many.sets({
        from: r.workoutExercises.id,
        to: r.sets.workoutExerciseId,
      }),
    },
    sets: {
      workoutExercise: r.one.workoutExercises({
        from: r.sets.workoutExerciseId,
        to: r.workoutExercises.id,
        optional: false,
      }),
    },
    // CHG-20261110-003-COACH-PLANS
    coachPlans: {
      exercises: r.many.coachPlanExercises({
        from: r.coachPlans.id,
        to: r.coachPlanExercises.coachPlanId,
      }),
    },
    coachPlanExercises: {
      plan: r.one.coachPlans({
        from: r.coachPlanExercises.coachPlanId,
        to: r.coachPlans.id,
        optional: false,
      }),
      exercise: r.one.exercises({
        from: r.coachPlanExercises.exerciseId,
        to: r.exercises.id,
        optional: false,
      }),
    },
  }),
);

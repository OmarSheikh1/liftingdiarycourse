import { defineRelations, sql } from "drizzle-orm";
import {
  boolean,
  check,
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

export const relations = defineRelations(
  { exercises, workouts, workoutExercises, sets },
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
  }),
);

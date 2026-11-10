# Plan: Add Exercises to Future Workouts

- **Change ID:** `CHG-20261110-001-PLAN-FUTURE-WORKOUT`
- **Status:** Implemented
- **Date:** 2026-11-10

Uniqueness check: no `CHANGELOG-AI.md` exists yet and `plans/` has no other plans, so this ID is unique.

## 1. Goal and Behaviour

When a user selects a **future date** on `/dashboard?date=YYYY-MM-DD`, they can plan a workout by adding exercises to it.

- The Workouts card shows an **"Add exercises"** button only when the selected date is after today.
- The button opens a shadcn `Dialog` with an exercise picker. The user can add an exercise to that day's planned workout and remove one.
- Planned exercises appear on the dashboard for that date, in order.
- Past and current dates behave exactly as they do today.
- Sets (reps and weight) are not part of planning. They are logged when the workout happens.

## 2. Design Decisions

1. **"Planned" is inferred, not stored.** A planned workout is a normal `workouts` row whose `startedAt` is on a future date. No schema change or migration, and no status column. Trade-off: "planned" depends on the date. An explicit `status` column can be added later if needed.
2. **One planned workout per user per day.** Adding an exercise finds or creates that day's workout (`startedAt` = start of the selected day), then inserts a `workout_exercises` row with the next `order`. The existing unique index on `(workoutId, order)` protects ordering.
3. **Exercise catalog.** The `exercises` table has no seed data. The picker lists built-in exercises (`userId` is null) plus the user's custom ones. To avoid an empty picker, the dialog also lets the user create a custom exercise by name, and a starter list of built-ins is seeded.
4. **Remove is included in v1.** Removing deletes the `workout_exercises` row, after verifying ownership through the parent workout. Remaining exercises keep their relative order. A gap in `order` is allowed.
5. **Server-side future-date rule.** The use case rejects non-future dates, so the rule is not only enforced in the UI.
6. **Duplicates.** Adding the same exercise twice to a day is allowed, since lifters repeat exercises in a session. The unique index is on `order`, not `exerciseId`.
7. **Validation.** Server Actions validate input with Zod. Zod is only a transitive dependency today, so it is added with `npm i zod`.
8. **Dialog file placement.** The dialog is a client component kept page-local in `src/app/dashboard/`, like the existing `date-input.tsx`. It only composes shadcn components (`Dialog`, `Button`, `Select`, `Input`, `Badge`) and is not a reusable UI component, which keeps it within `docs/ui.md`.

## 3. Architecture

**Followed:** Clean Architecture with Dependency Inversion (`docs/data-fetching.md`). Reads happen in Server Components via `src/composition/`. Writes are Server Actions that validate with Zod and call use cases. Data reaches Client Components through props.

**Existing modules being extended:**

- Port `WorkoutRepository` (`src/application/workouts/workout-repository.ts`)
- Implementation `DrizzleWorkoutRepository` (`src/data/workouts/drizzle-workout-repository.ts`)
- Composition `src/composition/workouts.ts`
- Use case pattern from `GetWorkoutsForDate`
- Dashboard page `src/app/dashboard/page.tsx`

**New modules:** an `ExerciseRepository` port with a Drizzle implementation, new use cases, a composition module for exercises, Server Actions and the dialog.

**Dependency direction:** Presentation imports only from `src/composition/` and `src/application/` types. Application imports only Domain and its own ports. Infrastructure implements the ports and is the only code importing `drizzle-orm` and `src/data/schema`. Composition is the only layer importing both Application and Infrastructure.

**User isolation:** `userId` is resolved only by `getAuthenticatedUserId()` in composition. Every query filters by it. Exercise ids from the client are checked to be built-in or owned by the user. Removal verifies ownership through the parent workout.

**Deviations:** none.

## 4. Files

### Application (`src/application/`)

| File | Change |
| --- | --- |
| `workouts/workout-repository.ts` | Modify: add `PlannedExerciseDto`; extend `WorkoutDto` with `exercises`; add `addExerciseToPlannedWorkout(userId, date, exerciseId)` and `removeExerciseFromWorkout(userId, workoutExerciseId)` |
| `workouts/add-exercise-to-plan.ts` | Create: use case, rejects non-future dates |
| `workouts/remove-exercise-from-plan.ts` | Create: use case |
| `workouts/get-workouts-for-date.ts` | Modify only if the DTO change requires it |
| `exercises/exercise-repository.ts` | Create: port with `listAvailableForUser(userId)` and `createCustom(userId, name)` |
| `exercises/list-available-exercises.ts` | Create: use case |
| `exercises/create-custom-exercise.ts` | Create: use case |

### Infrastructure (`src/data/`)

| File | Change |
| --- | --- |
| `workouts/drizzle-workout-repository.ts` | Modify: load exercise names per workout; implement add (find or create workout and insert, in a transaction) and remove (ownership-filtered) |
| `exercises/drizzle-exercise-repository.ts` | Create: implements `ExerciseRepository` with Drizzle, no raw SQL |
| `seed-exercises.ts` (or equivalent script) | Create: seeds the starter built-in exercises |

### Composition (`src/composition/`)

| File | Change |
| --- | --- |
| `workouts.ts` | Modify: add `addExerciseToPlan` and `removeExerciseFromPlan` |
| `exercises.ts` | Create: `listAvailableExercises` and `createCustomExercise` |

### Presentation (`src/app/`, `src/components/`)

| File | Change |
| --- | --- |
| `app/dashboard/page.tsx` | Modify: fetch exercises and show planned exercises; render the dialog trigger only for future dates |
| `app/dashboard/actions.ts` | Create: Server Actions with Zod validation, then `revalidatePath("/dashboard")` |
| `app/dashboard/add-exercises-dialog.tsx` | Create: client dialog composing shadcn components |
| `components/ui/dialog.tsx`, `select.tsx`, `label.tsx` | Added via `npx shadcn@latest add dialog select label` (CLI output only) |

### Other

| File | Change |
| --- | --- |
| `package.json` | Add `zod` |
| `CHANGELOG-AI.md` | Create with the entry for this Change ID |
| `CLAUDE.md` | Update the Status/architecture notes if needed |

All new or materially modified code carries `CHG-20261110-001-PLAN-FUTURE-WORKOUT` comments per `docs/change-tracking.md`.

## 5. Open Questions

Defaults will be used unless you say otherwise:

1. Is inferring "planned" from a future `startedAt` acceptable, or do you want an explicit status column? **Default: inferred.**
2. Exercise catalog: custom-exercise creation in the dialog, a seeded built-in list, or both? **Default: both.**
3. Should the starter built-in list be a short generic set (squat, bench press, deadlift, overhead press, barbell row, pull-up) or something specific from you? **Default: that short set.**
4. Is "start of the selected day" in the server's timezone acceptable for `startedAt`? The existing dashboard already uses `startOfDay` this way. **Default: yes.**

## 6. Verification

- `npm run lint` and `npm run build` pass.
- Manual check with the dev server (`npm run dev`):
  - On a future date, the button appears. Adding exercises shows them in order. Removing works.
  - On today and past dates, the button is absent.
  - The Server Action rejects a past or current date.
  - A second user cannot see, add to or remove from the first user's planned workout.
- No test runner is configured, so there are no automated tests. Use cases are written to be unit-testable with fake repositories once a runner exists.

## 7. Approval Log

- 2026-11-10: Draft written, awaiting user review.
- 2026-11-10: Approved by user with the default answers to all open questions.
- 2026-11-10: Implemented. Lint, type check and build pass.

### Deviations from the plan
- **No transaction** in `addExerciseToWorkoutOnDay`: the `neon-http` driver does not support interactive transactions. Statements run sequentially; the unique `(workout_id, order)` index guards concurrent inserts.
- **`isPlannableDate` and `PlanningError` live in `src/application/workouts/planning.ts`** (a new file not listed above).
- **Seed script** is run with `npm run db:seed` (script added to `package.json`); it has not been run yet.
- Removing the last exercise of a planned workout also deletes the empty workout.
- **Performance follow-up:** database round trips measured 1-8 s, so the dialog uses optimistic updates (`useOptimistic`) and stays usable while saving, repository calls use `db.batch()` to reduce trips, and the page loads workouts and exercises in parallel.

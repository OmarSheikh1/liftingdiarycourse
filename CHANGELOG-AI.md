# AI Change Log

## CHG-20261110-001-PLAN-FUTURE-WORKOUT — Add exercises to future workouts

- **Date:** 2026-11-10
- **Purpose:** When a future date is selected on the dashboard, let the user plan a workout by adding and removing exercises.
- **Prompt/task:** "if user selected a future date, he has an option to add exercises" (plan: `plans/plan-future-workout/plan.md`, approved by the user).

### Files created
- `docs/planning.md`, `plans/plan-future-workout/plan.md` (planning standards and the approved plan)
- `src/application/workouts/planning.ts`, `add-exercise-to-plan.ts`, `remove-exercise-from-plan.ts`
- `src/application/exercises/exercise-repository.ts`, `list-available-exercises.ts`, `create-custom-exercise.ts`
- `src/data/exercises/drizzle-exercise-repository.ts`, `src/data/seed-exercises.ts`
- `src/composition/exercises.ts`
- `src/app/dashboard/actions.ts`, `src/app/dashboard/add-exercises-dialog.tsx`
- `src/components/ui/dialog.tsx`, `select.tsx`, `label.tsx` (shadcn CLI output)

### Files modified
- `src/application/workouts/workout-repository.ts`, `src/data/workouts/drizzle-workout-repository.ts`, `src/composition/workouts.ts`
- `src/app/dashboard/page.tsx`
- `package.json` (added `zod`, `db:seed` script), `package-lock.json`
- `CLAUDE.md` (lists `docs/planning.md`)

### Architectural decisions
- Clean Architecture / Dependency Inversion as in `docs/data-fetching.md`: ports in Application, Drizzle in `src/data/`, wiring in `src/composition/`, Server Actions validate with Zod.
- "Planned" is inferred from a future `startedAt`; no schema change or migration.
- Future-date rule lives in the Application layer (`isPlannableDate`) and is enforced server-side.
- Removal only affects workouts starting tomorrow or later, and deletes the workout when it becomes empty.
- Deviation from plan: no database transaction, because the `neon-http` driver does not support interactive transactions. Statements run in sequence and the unique `(workout_id, order)` index guards concurrent inserts.

### Follow-up fix (same Change ID, 2026-11-10): slow/hanging dialog
- **Problem:** database round trips measured at 1-8 s each; adding an exercise made ~5 sequential calls plus a page refresh, and the dialog disabled all controls until done.
- **Fix:** optimistic list in `add-exercises-dialog.tsx` (`useOptimistic`), controls no longer locked so multiple exercises can be added in a row; `drizzle-workout-repository.ts` uses `db.batch()` to cut add to 2 trips (3 when the day's workout is created) and remove to 2; `dashboard/page.tsx` loads workouts and exercises in parallel.
- **Result:** lint, `tsc` and build pass. Not yet confirmed in the browser.

### Testing and build
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- No test runner is configured; manual browser testing (needs a Clerk sign-in) and `npm run db:seed` have not been run.

## CHG-20261110-002-WORKOUT-NAME — Name a planned workout

- **Date:** 2026-11-10
- **Purpose:** Planned workouts showed as "Untitled workout"; let the user name them.
- **Prompt/task:** "it shows new workout as untitled, there should be an option to add workout name" (plan: `plans/plan-future-workout/workout-name.md`, approved by the user).

### Files created
- `plans/plan-future-workout/workout-name.md`
- `src/application/workouts/rename-planned-workout.ts`

### Files modified
- `src/application/workouts/workout-repository.ts`, `src/data/workouts/drizzle-workout-repository.ts`, `src/composition/workouts.ts`
- `src/app/dashboard/actions.ts`, `src/app/dashboard/add-exercises-dialog.tsx`, `src/app/dashboard/page.tsx`

### Architectural decisions
- Uses the existing `workouts.name` column; no migration.
- Saving a name finds or creates the day's workout, so a name-only plan is valid; an empty name clears it.
- Removing the last exercise only deletes the workout when it is unnamed.
- Rename is limited to future dates in the use case (server-side) and validated with Zod in the Server Action.

### Testing and build
- `npm run lint`, `npx tsc --noEmit` and `npm run build`: passed.
- Not yet tried in the browser (needs a Clerk sign-in).

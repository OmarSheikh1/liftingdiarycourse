# Plan: Name a Planned Workout

- **Change ID:** `CHG-20261110-002-WORKOUT-NAME`
- **Status:** Implemented
- **Date:** 2026-11-10
- **Builds on:** `plan.md` (`CHG-20261110-001-PLAN-FUTURE-WORKOUT`)

Uniqueness check: `CHANGELOG-AI.md` only contains `-001-`.

## 1. Goal and Behaviour

Planned workouts currently show as "Untitled workout". The user should be able to give the workout a name.

- The "Plan workout" dialog gets a **Workout name** input with a **Save name** button, above the exercise list.
- The name is saved for that date's workout and shown as the card title on the dashboard (falls back to "Untitled workout" when empty).
- Clearing the name and saving removes it (stored as `NULL`).
- Only available on future dates, like the rest of planning.

## 2. Design Decisions

1. **Uses the existing `workouts.name` column.** No schema change or migration.
2. **Naming works before any exercise is added.** Saving a name finds or creates the day's workout, so a name-only plan is valid. Trade-off: a workout with zero exercises can exist.
3. **Removing the last exercise only deletes the workout if it has no name.** Otherwise a named plan would silently lose its name.
4. **Name rules:** trimmed, 1-80 characters; an empty value clears the name. Enforced in the use case and validated with Zod in the Server Action.
5. **Same speed approach as the exercise list:** the name updates optimistically in the dialog, and the database work uses one `db.batch()` read plus one write.
6. **No extra "plan" status.** Naming follows the same future-date rule (`isPlannableDate`) enforced server-side.

## 3. Architecture

**Followed:** Clean Architecture with Dependency Inversion (`docs/data-fetching.md`): the port is owned by Application, Drizzle lives in `src/data/`, wiring in `src/composition/`, and the Server Action validates with Zod and calls a use case. `userId` comes only from `getAuthenticatedUserId()`; the repository filters by owner.

**Extended (existing):** `WorkoutRepository` port, `DrizzleWorkoutRepository`, `composition/workouts.ts`, `dashboard/actions.ts`, `dashboard/add-exercises-dialog.tsx`, `dashboard/page.tsx`.

**New:** one use case, `RenamePlannedWorkout`.

**Dependency direction:** unchanged. Presentation imports composition/application types only; Infrastructure implements the port; no layer imports upward.

**Deviations:** none.

## 4. Files

| Layer | File | Change |
| --- | --- | --- |
| Application | `workouts/workout-repository.ts` | Add `setWorkoutNameOnDay(userId, dayStart, name \| null)` |
| Application | `workouts/rename-planned-workout.ts` | Create: validates future date and name rules |
| Infrastructure | `workouts/drizzle-workout-repository.ts` | Implement `setWorkoutNameOnDay` (find or create, then update name); only delete an emptied workout when its name is `NULL` |
| Composition | `workouts.ts` | Add `renamePlannedWorkout` |
| Presentation | `dashboard/actions.ts` | Add `renameWorkoutAction` (Zod) |
| Presentation | `dashboard/add-exercises-dialog.tsx` | Add name `Input` and `Button` using shadcn components, new `workoutName` prop |
| Presentation | `dashboard/page.tsx` | Pass the day's workout name to the dialog |
| Docs | `CHANGELOG-AI.md` | New entry for `-002-` |

Code changes carry `CHG-20261110-002-WORKOUT-NAME` comments.

## 5. Open Questions

Defaults will be used unless you say otherwise:

1. Save with a **Save name** button, or save automatically when you leave the field? **Default: button** (one clear action, no accidental writes).
2. Allow naming a day with no exercises yet? **Default: yes.**

## 6. Verification

- `npm run lint`, `npx tsc --noEmit` and `npm run build` pass.
- Manual: on a future date, set a name and see it as the card title; reload and it persists; clear it and it shows "Untitled workout"; remove the last exercise of a named workout and the name remains; a past or current date cannot be renamed through the action.

## 7. Approval Log

- 2026-11-10: Draft written, awaiting user review.
- 2026-11-10: Approved by user with the default answers.
- 2026-11-10: Implemented as planned, no deviations. Lint, type check and build pass.

# Plan: Coach Workout Plans for Gym Members

- **Change ID:** `CHG-20261110-003-COACH-PLANS`
- **Status:** Implemented
- **Date:** 2026-11-10

Uniqueness check: `CHANGELOG-AI.md` contains only `CHG-20261110-001-PLAN-FUTURE-WORKOUT` and `CHG-20261110-002-WORKOUT-NAME`, and no other plan uses this ID.

## 1. Goal and Behaviour

The signed-in user acts as a **coach**. There are no roles: any signed-in user can use the coach screens. A coach can:

1. Enter a **member's email**, choose a **future date**, and optionally name the plan.
2. Build the workout: add exercises (from the existing catalog or a new custom one), each with **sets, reps (with an optional upper rep for a range, e.g. 8-12), rest time, optional weight (kg) and notes**. Reorder is by add order; remove is supported.
3. See and manage the plans they created, and delete a plan.

A **member** (anyone whose verified Clerk email matches the plan's email) sees the plans assigned to them on `/dashboard` for the selected date, in a "From your coach" card, read-only. Their own planned and logged workouts are unchanged.

Out of scope for v1 (see Open Questions): emailing the member, editing a plan after its date has passed, templates, copying a plan to several dates, completing or logging a coach plan.

## 2. Design Decisions

1. **Separate tables, not rows in `workouts`.** The coach never writes to the member's `workouts`. That keeps `docs/data-fetching.md` Section 7 intact: every user-owned row is owned by exactly one Clerk user, and a member's own data is only ever written by the member. New tables `coach_plans` and `coach_plan_exercises` are owned by the coach (`coachUserId`) and merely *addressed* to a member email.
2. **Member identified by email, not user id.** The member may not have an account yet. The plan stores a lowercase, trimmed `memberEmail`. The member's side matches it against their **verified Clerk primary email**, read through a new port, never from client input.
3. **One plan per coach, member and date.** Unique index on `(coachUserId, memberEmail, planDate)`. Creating again for the same trio returns a clear error instead of duplicating.
4. **Plan date is a `date` column** (calendar day, no timezone), unlike `workouts.startedAt`. Future-date rule reuses `isPlannableDate` from `src/application/workouts/planning.ts`, enforced in the use case.
5. **Prescription fields.** `sets` and `reps` (positive ints; `reps` is the lower or only value), optional `repsMax` (>= `reps`, for ranges), `restSeconds` (nullable int, 0-1800), `weight` (numeric kg, nullable, matches `sets.weight`), `notes` (text, max 280, nullable). Duplicate exercises in one plan are allowed, as in the existing planner.
6. **Editing rules.** A plan can be edited or deleted only by its coach, and only while its date is still in the future. Members cannot edit.
7. **Two pages for the coach.** `/coach` (list plus "New plan" dialog) and `/coach/[planId]` (editor). Creating a plan redirects to the editor. Chosen over a single giant dialog because the editor has a table of exercises.
8. **No transactions.** The `neon-http` driver has none (see the deviation in `plan-future-workout/plan.md`). Multi-statement writes use `db.batch()`, and unique indexes guard races.
9. **Coach identity snapshot.** `coachEmail` is stored on the plan at creation so the member sees who assigned it, without a lookup of another user's data.
10. **Optimistic UI** in the editor, like `add-exercises-dialog.tsx`, because database round trips are slow here.

## 3. Data Model (Drizzle, `src/data/schema.ts`)

```ts
export const coachPlans = pgTable("coach_plans", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  coachUserId: text("coach_user_id").notNull(),   // Clerk id of the coach (owner)
  coachEmail: text("coach_email").notNull(),      // snapshot, shown to the member
  memberEmail: text("member_email").notNull(),    // lowercase, trimmed
  planDate: date("plan_date", { mode: "string" }).notNull(), // yyyy-MM-dd
  name: text(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("coach_plans_coach_member_date_uq").on(t.coachUserId, t.memberEmail, t.planDate),
  index("coach_plans_member_date_idx").on(t.memberEmail, t.planDate),
  index("coach_plans_coach_date_idx").on(t.coachUserId, t.planDate),
]);

export const coachPlanExercises = pgTable("coach_plan_exercises", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  coachPlanId: integer("coach_plan_id").notNull().references(() => coachPlans.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id, { onDelete: "restrict" }),
  order: integer("order").notNull(),
  sets: integer().notNull(),
  reps: integer().notNull(),
  repsMax: integer("reps_max"),                   // nullable, upper end of a rep range
  restSeconds: integer("rest_seconds"),           // nullable, rest between sets
  weight: numeric({ precision: 7, scale: 2 }),    // kg, nullable
  notes: text(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("coach_plan_exercises_plan_order_uq").on(t.coachPlanId, t.order),
  check("coach_plan_exercises_sets_positive", sql`${t.sets} > 0`),
  check("coach_plan_exercises_reps_positive", sql`${t.reps} > 0`),
  check("coach_plan_exercises_reps_max_gte", sql`${t.repsMax} is null or ${t.repsMax} >= ${t.reps}`),
  check("coach_plan_exercises_rest_range", sql`${t.restSeconds} is null or (${t.restSeconds} >= 0 and ${t.restSeconds} <= 1800)`),
  check("coach_plan_exercises_weight_nonneg", sql`${t.weight} >= 0`),
]);
```

Relations are added to the existing `defineRelations` call. Migration is generated with `drizzle-kit` into `drizzle/` (existing setup), and reviewed before applying.

## 4. Data Mutations

All writes are in `DrizzleCoachPlanRepository` (`src/data/coach/`), start with `import "server-only"`, use Drizzle only, and filter by `coachUserId`. All are triggered from Server Actions in `src/app/coach/actions.ts` (colocated, `"use server"`, typed object params, no `FormData`, Zod `safeParse` first, only `parsed.data` used, no `userId` accepted).

| Server Action (input) | Zod rules | Use case (rules) | Repository method |
| --- | --- | --- | --- |
| `createCoachPlanAction({ memberEmail, date, name })` | email trim/lowercase/max 254; date `yyyy-MM-dd` regex + valid; name trim max 80 | `CreateCoachPlan`: date must be future (`PlanningError`), email normalised | `createPlan(coachUserId, coachEmail, memberEmail, planDate, name)` returns `{ id }`; unique violation becomes `PlanningError("You already have a plan for this member on this date.")` |
| `addPlanExerciseAction({ planId, exerciseId, sets, reps, repsMax, restSeconds, weight, notes })` | ids positive int; sets 1-20, reps 1-100 ints; repsMax null or int >= reps (max 100); restSeconds null or int 0-1800; weight null or 0-1000, 2dp; notes trim max 280 | `AddExerciseToCoachPlan`: plan must be owned and still future | `addExercise(coachUserId, planId, item)`: verifies owner via the plan, checks exercise is built-in or the coach's, inserts at next `order` |
| `updatePlanExerciseAction({ planExerciseId, sets, reps, repsMax, restSeconds, weight, notes })` | same ranges | `UpdateCoachPlanExercise` | `updateExercise(coachUserId, planExerciseId, fields)`: ownership through parent plan (user-scoped subquery) |
| `removePlanExerciseAction({ planExerciseId })` | positive int | `RemoveCoachPlanExercise` | `removeExercise(coachUserId, planExerciseId)` |
| `renameCoachPlanAction({ planId, name })` | name trim max 80 | `RenameCoachPlan` | `setName(coachUserId, planId, name)` |
| `deleteCoachPlanAction({ planId })` | positive int | `DeleteCoachPlan` | `deletePlan(coachUserId, planId)`; exercises cascade |
| `createAndAddPlanExerciseAction(...)` | as above plus name 1-80 | reuses `CreateCustomExercise` then `AddExerciseToCoachPlan` | existing exercise repository plus `addExercise` |

Each action returns `ActionResult` (`{ ok: true } | { ok: false; error }`), catches only `PlanningError`, and calls `revalidatePath("/coach")`, `revalidatePath("/coach/[planId]", "page")` and `revalidatePath("/dashboard")` on success. Update, remove and delete return no-op results for non-owned ids, with no leak of whether the id exists.

## 5. Data Fetching (Server Components only)

| Page | Composition call | Returns |
| --- | --- | --- |
| `/coach` | `listCoachPlans()` | Upcoming and past plans the coach created (member email, date, name, exercise count) |
| `/coach/[planId]` | `getCoachPlan(planId)` plus existing `listAvailableExercises()` in parallel | Plan with exercises, or `notFound()` if not owned |
| `/dashboard` | `getAssignedPlansForDate(date)` | Plans addressed to the viewer's verified email on that date, with exercises and `coachEmail` |

`getAssignedPlansForDate` resolves the viewer's email through the new `UserEmailProvider` port. If the user has no verified email, it returns an empty list.

## 6. UI (shadcn/ui only, date-fns `"do MMM yyyy"`)

No custom reusable components, per `docs/ui.md`. Page-local client files only compose shadcn components, as `date-input.tsx` and `add-exercises-dialog.tsx` already do.

**`/coach`**
- `Card` titled "Member plans" with a `Button` "New plan" opening `Dialog`.
- Dialog form: `Label` + `Input type="email"` (member email), `Popover` + `Calendar` for the date (days up to and including today disabled), `Input` for an optional name, `Button` "Create and add exercises". Inline error text from `ActionResult`. On success it navigates to `/coach/[planId]` (`useRouter` from the client dialog).
- Below: a `Table` of plans (Member, Date, Name, Exercises, actions) with `Badge` for "Upcoming" or "Past", a "Open" `Button` (link), and an `AlertDialog` to confirm delete.

**`/coach/[planId]`**
- `Card` header: member email, formatted date, editable name (`Input` saved on blur).
- `Table` of exercises: #, Exercise, Sets, Reps (e.g. 8-12), Rest, Weight (kg), Notes, remove `Button`. Sets, reps, max reps, rest, weight are `Input type="number"` saved on blur via `updatePlanExerciseAction`.
- "Add exercise" row: `Select` (catalog), sets, reps, max reps (optional), rest (seconds, optional), weight and notes inputs, `Button`. Same row offers a "Create custom exercise" `Input` mirroring the existing dialog.
- Optimistic updates with `useOptimistic`, errors shown inline.
- If the date has passed, the page is read-only (inputs disabled, no add or delete).

**`/dashboard` (member view)**
- New `Card` "From your coach" shown only when `getAssignedPlansForDate` returns something: coach email, plan name, and a list of `Badge`/`Table` rows `Exercise — 3 × 8-12 @ 60 kg, rest 90s — note`.
- A `Button` link "Coach plans" in the dashboard header to `/coach`.

New shadcn components added via CLI: `table`, `textarea`, `alert-dialog`. Existing: `button`, `card`, `dialog`, `input`, `label`, `popover`, `calendar`, `select`, `badge`.

## 7. Architecture

**Followed:** Clean Architecture with Dependency Inversion (`docs/data-fetching.md`), Server Components for reads, Server Actions (colocated `actions.ts`) with Zod for writes, per `docs/data-mutations.md`, SOLID per `docs/solid.md`, Clerk behind a port per `docs/auth.md`.

| Layer | Files | Status |
| --- | --- | --- |
| Domain / Application rules | `src/application/coach/coach-plan-rules.ts` (`normalizeEmail`, reuse `isPlannableDate`, `PlanningError`) | New |
| Application ports | `src/application/coach/coach-plan-repository.ts` (`CoachPlanRepository`, DTOs, narrow `AssignedPlanReader = Pick<...>`); `src/application/auth/user-email-provider.ts` (`UserEmailProvider.getEmail()`) | New |
| Application use cases (one per file) | `src/application/coach/`: `create-coach-plan.ts`, `list-coach-plans.ts`, `get-coach-plan.ts`, `add-exercise-to-coach-plan.ts`, `update-coach-plan-exercise.ts`, `remove-coach-plan-exercise.ts`, `rename-coach-plan.ts`, `delete-coach-plan.ts`, `get-assigned-plans-for-date.ts` | New |
| Infrastructure | `src/data/schema.ts` (modify: two tables, relations); `src/data/coach/drizzle-coach-plan-repository.ts` (new); `src/data/auth/clerk-user-email-provider.ts` (new, Clerk adapter, `server-only`); `drizzle/` migration (generated) | Mixed |
| Composition | `src/composition/coach.ts` (new: resolves `userId` and email, builds use cases); `src/composition/auth.ts` (modify: add `getAuthenticatedUserEmail()`) | Mixed |
| Presentation | `src/app/coach/page.tsx`, `new-plan-dialog.tsx`, `delete-plan-button.tsx`, `actions.ts`; `src/app/coach/[planId]/page.tsx`, `plan-editor.tsx`; `src/app/dashboard/page.tsx` (modify: assigned-plans card and link) | Mixed |

**Existing modules extended, not duplicated:** `ExerciseRepository` and its use cases (catalog, custom exercise), `PlanningError` and `isPlannableDate`, `getAuthenticatedUserId()`, the dashboard page. `WorkoutRepository` is **not** modified (OCP, ISP): coach plans are a different aggregate with a different owner, so they get their own port.

**Dependency direction:** Presentation imports composition and Application types only. Application imports Domain and its own ports. `src/data/` implements the ports and is the only place importing `drizzle-orm`, `@/data/db`, `@/data/schema`, and Clerk server APIs. `src/composition/` is the only place that imports both.

**Auth:** Clerk stays behind ports. The new `UserEmailProvider` is separate from `SessionProvider` (ISP: `SessionProvider` stays single-method). The Clerk adapter reads the verified primary email server-side. No Clerk import appears in Application, Domain or Presentation.

**User isolation:** `coachUserId` and email come only from composition. Every coach query and write filters by `coachUserId`; child rows are checked through the parent plan. The member read filters by the viewer's verified email. A coach can never read or write another coach's plans, and nobody writes to another user's `workouts`.

**Deviations from the docs:** none. (Note: `docs/auth.md` says not to call `currentUser()` for an *id*; the adapter uses Clerk only to read the verified *email*, inside `src/data/auth/` as the doc requires.)

## 8. Security and Privacy Notes

- Any signed-in user can address a plan to any email (accepted by the user). A member only sees plans addressed to their own verified email, and cannot edit them.
- Emails are personal data: they are never logged, never put in URLs, and not echoed in errors beyond what the coach typed.
- Members never receive the coach's user id, only the coach's email snapshot.
- Unique-violation and not-found errors are generic and user-safe.

## 9. Decisions (answered by user, 2026-11-10)

1. **Open assignment:** any signed-in user can create a plan for any email. No allowlist, accept flow or blocking in v1.
2. **No email notification.** The member sees the plan after signing in with that email.
3. **Fields:** sets, reps (with optional rep range), rest time, weight, notes.
4. **Editing:** a coach can edit or delete only plans they created, and only while the plan date is in the future. Plans created for others can never be edited by the member or by any other user; past plans are read-only.

Still defaulted: member match uses the verified Clerk primary email; a coach may assign to their own email; separate `/coach` and `/coach/[planId]` pages.

## 10. Implementation Order

1. Add shadcn components (`table`, `textarea`, `alert-dialog`).
2. Schema, relations, generate and review the migration; apply it to the Neon database after your confirmation.
3. Application: rules, ports, use cases.
4. Infrastructure: `DrizzleCoachPlanRepository`, `ClerkUserEmailProvider`.
5. Composition: `coach.ts`, `getAuthenticatedUserEmail`.
6. Presentation: actions, `/coach`, `/coach/[planId]`, dashboard card and link.
7. `CHANGELOG-AI.md` entry; update `CLAUDE.md` status notes; mark this plan `Implemented` with deviations.

## 11. Verification

- `npm run lint` and `npm run build` pass; type check clean.
- Manual, with `npm run dev` and two Clerk accounts (coach A, member B):
  - A creates a plan for B's email on a future date; today or past dates are rejected by the UI and by the action.
  - A adds, edits, removes exercises and sees them in order; duplicate plan for the same member and date shows the friendly error.
  - B opens `/dashboard?date=<that date>` and sees "From your coach", read-only; a different user C sees nothing.
  - C calling the actions with A's plan ids gets a no-op or not-found; `/coach/<A's id>` is `notFound()` for C.
  - Invalid input (bad email, `sets: 0`, huge notes) is rejected by Zod.
- No test runner exists, so use cases are written to be unit-testable with fake repositories (ownership scoping honored by the fake, per `docs/solid.md` LSP).

## 12. Approval Log

- 2026-11-10: Draft written, awaiting user review.
- 2026-11-10: User answered open questions (open assignment, no email, add rest time and rep range, edit own future plans only). Plan revised, awaiting explicit approval.
- 2026-11-11: User asked to implement the plan ("lets implement the coach workout plan"); treated as approval. Status set to Approved.
- 2026-11-11: Implemented (code). Lint, `tsc` and build pass. Migration `drizzle/20261111044105_old_tiger_shark` generated but not yet applied to Neon (awaiting user confirmation).

## 13. Implementation Notes / Deviations

- Editability is enforced by passing `earliestEditableDate` into the repository methods (one ownership-and-date-checked query per write) rather than a separate read in the use case.
- Duplicate-plan detection uses `onConflictDoNothing` instead of catching a unique-violation error.
- `getAuthenticatedUserEmail()` returns `string | null`; `createCoachPlan` throws a `PlanningError` when the coach has no verified email.

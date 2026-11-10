# Data Mutation Standards

## 1. Core Rules (CRITICAL)

Every create, update, or delete of application data MUST follow all of these rules:

1. **Database writes happen ONLY in helper functions inside `src/data/`** that wrap Drizzle ORM calls.
2. **Every mutation is triggered by a Server Action** defined in a **colocated file named `actions.ts`**.
3. **Server Action parameters MUST be explicitly typed and MUST NOT use `FormData`.**
4. **Every Server Action MUST validate its arguments with Zod** before doing anything with them.

These rules extend `docs/data-fetching.md` (architecture, Drizzle only, no raw SQL, user isolation) and `docs/auth.md` (Clerk, `getAuthenticatedUserId()`). If a rule here conflicts with general knowledge or defaults, this document wins.

## 2. Mutation Flow

```text
Client Component (event handler)
  -> Server Action              src/app/<route>/actions.ts   (Zod validation, revalidation)
    -> composition function     src/composition/*            (resolves userId, wires use case)
      -> use case               src/application/*            (authorization, business rules)
        -> data helper          src/data/*                   (Drizzle write, ownership-filtered)
```

- The helper functions in `src/data/` are the repository methods (or standalone functions) that wrap Drizzle. They are the ONLY code that writes to the database.
- Server Actions, use cases, composition modules, and components MUST NOT import `drizzle-orm`, `@/data/db`, or `@/data/schema`.
- Ports for these helpers are owned by the Application layer (see `docs/data-fetching.md` Sections 3-5). Do not skip the port or the composition module.

## 3. Data Helper Functions (`src/data/`)

Rules:

- Every helper wraps Drizzle's typed query builder. **NO RAW SQL.**
- Helpers start with `import "server-only"`.
- Helpers take plain, typed arguments (application types or DTOs) and return DTOs or plain values, never Drizzle rows, query builders, or SQL objects.
- Helpers that touch user-owned data take the authenticated `userId` and MUST filter on it in the `where` clause of every update and delete. Inserts MUST set `userId` from the verified value, never from client data.
- Updates and deletes by record id MUST also filter by owner: `and(eq(table.id, id), eq(table.userId, userId))`. Child records verify ownership through their parent (join or user-scoped subquery).
- Multi-step writes that must succeed or fail together MUST use a Drizzle transaction inside the helper.
- Helpers contain persistence logic only. Business rules belong in use cases or the Domain.
- Name helpers by intent (`createWorkout`, `renameWorkout`, `removeWorkoutExercise`), one concern per function.

```ts
// src/data/workouts/drizzle-workout-repository.ts (excerpt)
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/data/db";
import { workouts } from "@/data/schema";

async renameWorkout(id: number, userId: string, name: string | null) {
  const updated = await db
    .update(workouts)
    .set({ name })
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
    .returning({ id: workouts.id });
  return updated.length > 0;
}
```

## 4. Server Actions (`actions.ts`)

### File placement and naming

- Server Actions live ONLY in files named **`actions.ts`**, colocated with the route or feature that uses them (e.g. `src/app/dashboard/actions.ts`).
- Each `actions.ts` begins with the `"use server"` directive.
- Do not define Server Actions inline in components, in `page.tsx`, or in files with any other name.
- Do not create route handlers (`route.ts`, `app/api/*`) for mutations.
- Only async functions are exported from an `actions.ts` file (plus types). Shared schemas and helpers stay unexported.

### Typed parameters, never `FormData` (CRITICAL)

- Every action parameter MUST have an explicit TypeScript type. Prefer a single typed object parameter.
- **`FormData` MUST NOT be used as a parameter type, and `formData.get(...)` MUST NOT appear in actions.** Client Components collect values and call the action with plain typed arguments.
- Do not use `any`, `unknown` without immediate validation, or untyped parameters.
- Dates cross the boundary as `yyyy-MM-dd` strings (see `docs/ui.md` for date-fns rules), not `Date` objects.

```ts
export async function renameWorkoutAction(input: {
  date: string;
  name: string;
}): Promise<ActionResult> {
  // ...
}
```

### Zod validation (CRITICAL)

- **ALL Server Actions MUST validate every argument with Zod** before any other work. TypeScript types are not validation: the client can send anything.
- Use `schema.safeParse(input)`. On failure, return `{ ok: false, error }` with a user-safe message. Do not call use cases with unvalidated data.
- Use only the parsed data (`parsed.data`) afterwards, never the raw input.
- Constrain every field: lengths (`.trim().min().max()`), integer and positive ids (`z.number().int().positive()`), formats (`.regex()`), enums, and so on.
- Schemas are defined at module level in the same `actions.ts` (or imported from a shared validation module), and the TypeScript parameter type should match the schema (`z.input<typeof schema>` is fine).
- Never accept a `userId` as an argument. Identity comes from the server (Section 5).

### Return values and errors

- Return a serializable result, such as `type ActionResult = { ok: true } | { ok: false; error: string }`, for expected failures (validation, business-rule errors).
- Catch only known, user-facing error types (e.g. `PlanningError`). Let unexpected errors and framework redirects (unauthenticated users) propagate.
- Never leak database errors, SQL, stack traces, or another user's data in an error message.
- After a successful mutation, call `revalidatePath` (or `revalidateTag`) for the affected routes.

### Canonical shape

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { removeExerciseFromPlan } from "@/composition/workouts";

export type ActionResult = { ok: true } | { ok: false; error: string };

const removeSchema = z.object({
  workoutExerciseId: z.number().int().positive(),
});

export async function removeExerciseAction(input: {
  workoutExerciseId: number;
}): Promise<ActionResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await removeExerciseFromPlan(parsed.data.workoutExerciseId);
  revalidatePath("/dashboard");
  return { ok: true };
}
```

## 5. Authentication and Authorization

- Every action authenticates the caller. This happens through the composition function, which calls `getAuthenticatedUserId()` from `src/composition/auth.ts`. Unauthenticated callers are redirected or rejected, and nothing is written.
- Validate with Zod, then authenticate and authorize. Never trust client-supplied ownership information.
- Use cases enforce authorization. Data helpers enforce ownership in every write query. An action alone is never the security boundary.
- A user MUST NOT be able to create, change, or delete another user's data, directly or through child records.

## 6. Calling Actions from the Client

- Client Components call actions from event handlers or `useTransition`/`useActionState`, passing typed plain values. They do not build `FormData`.
- Client Components may import actions and the `ActionResult` type, and nothing else from `src/data/` or `src/composition/`.
- Reads still happen in Server Components only (`docs/data-fetching.md` Section 2). Actions are for mutations.

## 7. Testing

- Use cases are tested with fake repositories.
- Zod schemas should be tested with valid and invalid input once a test runner is configured (none is configured yet).
- User isolation for write helpers SHOULD be covered by integration tests.

## 8. Final Checklist

Before completing any mutation-related change:

- [ ] The database write lives in a helper function in `src/data/` using Drizzle, with no raw SQL.
- [ ] The helper is only reachable through an Application port and the composition module.
- [ ] The Server Action is in a colocated file named `actions.ts` with `"use server"`.
- [ ] All action parameters are explicitly typed, and none is `FormData`.
- [ ] The action validates all arguments with Zod using `safeParse`, and uses only the parsed data.
- [ ] No `userId` is accepted from the client. Identity comes from `getAuthenticatedUserId()`.
- [ ] Every update and delete query filters by the authenticated owner.
- [ ] Related paths are revalidated after success.
- [ ] Errors returned to the client are user-safe, with no internals leaked.
- [ ] No mutation goes through a route handler or a client-side database call.

**GOLDEN RULE: Typed arguments in, Zod validation at the door, ownership-checked Drizzle helper in `src/data/` at the bottom.**

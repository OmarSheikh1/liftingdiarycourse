# SOLID Principles Standards

## 1. Policy (CRITICAL)

**The five SOLID principles MUST be followed strictly in all code in this app.** They are not suggestions. Code that violates them must be fixed before a task is considered complete, and reviewers must reject it.

This document complements:

- `docs/data-fetching.md` — Clean Architecture layers, ports, composition root (the structural application of SOLID).
- `docs/data-mutations.md` — Server Actions and Drizzle helpers.
- `docs/auth.md` — Clerk isolated behind a port.
- `docs/ui.md` — shadcn/ui components only.

The examples below use real code from this project. Follow those patterns when adding features.

### Pragmatism guard

Strict SOLID does **not** mean extra ceremony. Do not create interfaces, factories, or layers with no second consumer or no real boundary (see `docs/data-fetching.md` Section 11). The boundaries that always require abstractions in this app: database, authentication provider, external services, clock, logging.

---

## 2. S — Single Responsibility Principle

**A module, class, or function has exactly one reason to change.**

Rules:

- One use case per file, one operation per use case (`AddExerciseToPlan`, `RenamePlannedWorkout`, `RemoveExerciseFromPlan`).
- Each layer has one job: Domain (business rules), Application (use case orchestration), Infrastructure (persistence/adapters), Composition (wiring), Presentation (rendering and calling actions).
- Server Actions do three things only: validate (Zod), delegate to a composition function, revalidate. No business rules, no database access.
- Components render UI. Data fetching and business logic do not belong in them.
- If you describe a file with "and" ("validates AND saves AND formats AND..."), split it.

### Good (this project)

```ts
// src/application/workouts/add-exercise-to-plan.ts
// One responsibility: the "add exercise to plan" business rule.
export class AddExerciseToPlan {
  constructor(private readonly repository: WorkoutRepository) {}

  async execute(userId: string, date: Date, exerciseId: number): Promise<void> {
    if (!isPlannableDate(date)) {
      throw new PlanningError("Exercises can only be planned for future dates.");
    }
    await this.repository.addExerciseToWorkoutOnDay(userId, startOfDay(date), exerciseId);
  }
}
```

### Bad

```ts
// Validation + business rule + SQL + cache invalidation in one place.
export async function addExercise(formData: FormData) {
  const date = new Date(formData.get("date") as string);
  if (date < new Date()) throw new Error("future only");
  await db.insert(workoutExercises).values({ /* ... */ });
  revalidatePath("/dashboard");
}
```

---

## 3. O — Open/Closed Principle

**Code is open for extension, closed for modification.** Add behavior by adding new code that plugs into an abstraction, not by editing working code with growing `if`/`switch` chains.

Rules:

- New features add new use cases, new repository port methods, and new adapters. They do not rewrite existing use cases.
- Extend behavior through ports and composition: to change where data is stored or how identity is resolved, write a new implementation of the port and change the composition module.
- Do not branch on "type" strings or flags inside a use case to vary behavior. Use polymorphism (a different implementation of the port) instead.
- Existing function signatures that others depend on are not changed in breaking ways to satisfy a new feature. Add a new function or an optional parameter.

### Good (this project)

Planning added `AddExerciseToPlan`, `RemoveExerciseFromPlan`, and `RenamePlannedWorkout` as new use cases. `GetWorkoutsForDate` was not modified. The repository port grew new methods; existing ones stayed unchanged.

```ts
// New behavior = new class, existing use cases untouched.
export class RenamePlannedWorkout {
  constructor(private readonly repository: WorkoutRepository) {}
  async execute(userId: string, date: Date, name: string): Promise<void> { /* ... */ }
}
```

### Bad

```ts
// Every new feature edits this function and grows the switch.
export async function workoutOperation(kind: "add" | "remove" | "rename", ...args: unknown[]) {
  switch (kind) {
    case "add": /* ... */ break;
    case "remove": /* ... */ break;
    // next feature: edit here again
  }
}
```

---

## 4. L — Liskov Substitution Principle

**Any implementation of a port must be usable wherever the port is expected, without the caller knowing or breaking.**

Rules:

- Implementations honor the full contract of the port: the same parameter meaning, return shape, nullability, and documented errors.
- An implementation MUST NOT strengthen preconditions (reject inputs the port accepts) or weaken postconditions (return less than the port promises).
- Document the contract in the port's TSDoc (ownership scoping, "no-op if not found", what it throws). Every implementation, including test fakes, follows it.
- Never throw "not implemented" from a port method. If a method does not apply, the port is wrong: split it (see Interface Segregation).
- Callers MUST NOT use `instanceof` or type checks to special-case a particular implementation.
- Every repository implementation MUST enforce user ownership exactly as the port documents. A fake used in tests must do the same.

### Good (this project)

```ts
// The port documents the contract...
export interface WorkoutRepository {
  /** Workouts owned by `userId` that started in [from, to). */
  findForUserBetween(userId: string, from: Date, to: Date): Promise<WorkoutDto[]>;
}

// ...and any implementation (Drizzle, or an in-memory fake for tests) honors it:
class InMemoryWorkoutRepository implements WorkoutRepository {
  constructor(private readonly rows: (WorkoutDto & { userId: string })[]) {}

  async findForUserBetween(userId: string, from: Date, to: Date) {
    return this.rows.filter(
      (w) => w.userId === userId && w.startedAt >= from && w.startedAt < to,
    );
  }
}
```

`GetWorkoutsForDate` works identically with either one.

### Bad

```ts
class ReadOnlyWorkoutRepository implements WorkoutRepository {
  async addExerciseToWorkoutOnDay(): Promise<void> {
    throw new Error("Not supported"); // breaks every caller that trusts the port
  }
  // ...
}
```

---

## 5. I — Interface Segregation Principle

**Consumers depend only on the methods they use.** Keep ports small and cohesive, and split fat interfaces.

Rules:

- Ports are feature-specific (`WorkoutRepository`, `ExerciseRepository`, `SessionProvider`), never a single catch-all `Repository` or `Database` interface.
- A port has one role. `SessionProvider` only answers "who is the verified user?"; it does not also create sessions or fetch profiles.
- If a use case needs only part of a port, or a port grows methods unrelated to some of its consumers, split it into smaller ports (e.g. `WorkoutReader` and `WorkoutWriter`) or define a narrow interface in the use case's own file.
- Component props contain only the fields the component renders. Do not pass whole DTOs or objects "just in case".
- Server Action input types contain only the fields the action needs.

### Good (this project)

```ts
// src/application/auth/session-provider.ts
// A single-method port. Callers cannot depend on anything Clerk-specific.
export interface SessionProvider {
  /** Verified id of the current user, or null when signed out. */
  getUserId(): Promise<string | null>;
}
```

If read-only consumers multiply, narrow the dependency:

```ts
// A use case that only reads depends only on reads.
export type WorkoutReader = Pick<WorkoutRepository, "findForUserBetween">;

export class GetWorkoutsForDate {
  constructor(private readonly repository: WorkoutReader) {}
  // ...
}
```

### Bad

```ts
// God interface: every consumer depends on everything.
export interface AppRepository {
  findWorkouts(...): Promise<WorkoutDto[]>;
  addExercise(...): Promise<void>;
  getUser(...): Promise<User>;
  sendEmail(...): Promise<void>;
  writeAuditLog(...): Promise<void>;
}
```

---

## 6. D — Dependency Inversion Principle

**High-level modules do not depend on low-level modules. Both depend on abstractions, and the Application layer owns the abstractions.**

Rules:

- `src/domain/` and `src/application/` MUST NOT import from `src/data/`, `drizzle-orm`, `@clerk/*`, `next/*` request APIs, or any concrete implementation.
- Use cases receive their dependencies through the constructor, typed as ports (interfaces).
- Concrete classes are constructed ONLY in `src/composition/`, the single place that knows both sides.
- Presentation (`src/app/`, `src/components/`) calls composition functions. It never imports `src/data/` and never constructs repositories.
- Do not call `new DrizzleXRepository()` or `auth()` inside a use case, action, or component.
- Time, randomness, and identity are dependencies as well: obtain "now" and "current user" through an injected value or port, not a hidden global, when business logic depends on them. The current user id is passed in as `userId`.

### Good (this project)

```ts
// 1. Application owns the abstraction.
// src/application/workouts/workout-repository.ts
export interface WorkoutRepository { /* ... */ }

// 2. Application depends on the abstraction (constructor injection).
// src/application/workouts/add-exercise-to-plan.ts
export class AddExerciseToPlan {
  constructor(private readonly repository: WorkoutRepository) {}
}

// 3. Infrastructure implements it.
// src/data/workouts/drizzle-workout-repository.ts
export class DrizzleWorkoutRepository implements WorkoutRepository { /* ... */ }

// 4. Composition is the only place that binds them and supplies the verified user.
// src/composition/workouts.ts
export async function addExerciseToPlan(date: Date, exerciseId: number) {
  const userId = await getAuthenticatedUserId();
  return new AddExerciseToPlan(new DrizzleWorkoutRepository()).execute(userId, date, exerciseId);
}

// 5. Presentation calls composition only.
// src/app/dashboard/actions.ts
import { addExerciseToPlan } from "@/composition/workouts";
```

### Bad

```ts
// Use case reaching down into infrastructure and the auth provider.
import { db } from "@/data/db";
import { auth } from "@clerk/nextjs/server";

export class AddExerciseToPlan {
  async execute(exerciseId: number) {
    const { userId } = await auth();               // hard-wired to Clerk
    await db.insert(workoutExercises).values(...); // hard-wired to Drizzle
  }
}
```

---

## 7. Applying SOLID to a New Feature

Follow this order. It produces SOLID-compliant code by construction.

1. **Rules and entities (S):** identify real business rules. Put pure ones in `src/domain/` (or a small pure module in the feature's `src/application/` folder, like `planning.ts`).
2. **Use case (S, O):** create one new class per operation in `src/application/<feature>/`, with `execute(userId, ...)`.
3. **Port (I, D):** add or extend the narrowest repository port in `src/application/<feature>/`. Document the contract (ownership, errors, no-ops).
4. **Adapter (L, D):** implement the port in `src/data/<feature>/` with Drizzle. Honor the contract exactly.
5. **Composition (D):** add a function in `src/composition/<feature>.ts` that resolves `userId`, constructs the adapter, and runs the use case.
6. **Presentation (S):** a Server Component calls the composition function (reads), or a Server Action in `actions.ts` validates with Zod and calls it (writes).

## 8. Review Checklist

Before completing any change:

**S**
- [ ] Each file/class/function has one reason to change.
- [ ] Actions only validate, delegate, revalidate. Components only render.

**O**
- [ ] New behavior was added as new code behind a port, not by growing conditionals in existing use cases.
- [ ] Existing public signatures were not broken.

**L**
- [ ] Every port implementation (including fakes) honors the documented contract, including ownership scoping.
- [ ] No "not implemented" methods and no `instanceof` special-casing of implementations.

**I**
- [ ] Ports are small, feature-specific, and single-role.
- [ ] Use cases, props, and action inputs include only what they use.

**D**
- [ ] No Domain/Application imports of `src/data/`, Drizzle, Clerk, or Next.js request APIs.
- [ ] Dependencies are injected via constructors, with concrete classes built only in `src/composition/`.

**GOLDEN RULE: Depend on abstractions you own, give every module one job, add by extending instead of editing, and keep implementations interchangeable.**

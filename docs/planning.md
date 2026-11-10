# Planning Standards

All implementation plans MUST be written to the `plans/` folder and approved by the user before any code is written.

## 1. Where Plans Live

- Every plan is a Markdown file inside the repository-level `plans/` directory.
- **Feature-related plans MUST live in a feature folder:** `plans/<feature-name>/`. Use kebab-case, e.g. `plans/plan-future-workout/`.
- Plans that are not tied to a feature (refactors, tooling, infrastructure, bug fixes) go directly in `plans/`.
- Do not leave plans only in chat. A plan that is not saved in `plans/` does not count as a plan.

```text
plans/
  plan-future-workout/
    plan.md                 Main plan for the feature
    exercise-picker.md      Optional follow-up plan within the same feature
  upgrade-next-version.md   Non-feature plan
```

## 2. File Naming

- Use kebab-case file names.
- The main plan for a feature folder is `plan.md`. Additional plans in the same folder use a descriptive name.
- Do not reuse a plan file for an unrelated task. Create a new file instead.

## 3. Required Contents

Every plan MUST include:

1. **Change ID** (the changeset): `CHG-YYYYMMDD-NNN-FEATURE-NAME`, as defined in `docs/change-tracking.md`. The same Change ID is used for the code comments and the `CHANGELOG-AI.md` entry when the plan is implemented. Check `CHANGELOG-AI.md` and existing plans for uniqueness.
2. **Status**: one of `Draft`, `Approved`, `Implemented`, `Rejected`.
3. **Date** the plan was written.
4. **Goal and behaviour**: what is being built and why.
5. **Design decisions**: key choices and alternatives, so the user can review them.
6. **Architecture**: the architecture followed and how the change continues it (see Section 4).
7. **Files to create and modify**, grouped by layer (see `docs/data-fetching.md`).
8. **Open questions** for the user, if any.
9. **Verification**: how the change will be checked (lint, build, tests where a runner exists).

## 4. Architecture Relevance (MANDATORY)

Every plan MUST state which architecture it follows and show how the change continues it. Plans must not introduce a different architecture.

### Architecture followed in this project

**Clean Architecture with Dependency Inversion**, as defined in `docs/data-fetching.md`:

```text
Presentation   -> Application
Composition    -> Application, Infrastructure   (the ONLY place that knows both)
Infrastructure -> Application                   (implements its ports)
Application    -> Domain
Domain         -> nothing
```

| Layer | Location | Role |
| --- | --- | --- |
| Domain | `src/domain/` | Pure business rules (only when real rules exist) |
| Application | `src/application/` | Use cases, ports (repository interfaces), DTOs |
| Infrastructure | `src/data/` | Drizzle schema, DB connection, repository implementations, auth adapters |
| Composition | `src/composition/` | Server-only wiring of implementations to use cases; resolves the authenticated user |
| Presentation | `src/app/`, `src/components/` | Server Components, Client Components, Server Actions, shadcn/ui |

### Conventions we are continuing

- **Reads:** Server Components only, calling use cases through `src/composition/`. Data goes to Client Components via props.
- **Writes:** Server Actions that validate with Zod, then call use cases. No direct database access.
- **Ports:** repository interfaces are owned by the Application layer (e.g. `WorkoutRepository` in `src/application/workouts/`). Implementations live in `src/data/` (e.g. `DrizzleWorkoutRepository`). Extend the existing port and implementation for a feature rather than creating parallel ones.
- **Database:** Drizzle ORM only, no raw SQL, and no Drizzle types outside `src/data/`.
- **User isolation:** `userId` comes only from `getAuthenticatedUserId()` in the composition layer. Every query filters by owner.
- **UI:** shadcn/ui components only, with date-fns date formatting (`docs/ui.md`).
- **Pragmatism:** prefer a thin use case, a port and a Drizzle implementation over extra layers. Never skip the port or the composition module.

### What each plan must include

An **"Architecture"** section that:

1. Names the architecture being followed (Clean Architecture, Dependency Inversion, Server Components for reads, Server Actions for writes).
2. Maps every file to create or modify to its layer.
3. Lists the existing ports, use cases and modules being extended, and any new ones.
4. Confirms the dependency direction is respected, with no layer importing from a layer it must not depend on.
5. Explains any deviation from `docs/data-fetching.md` or `docs/ui.md` and why. Deviations need explicit user approval.

## 5. Workflow (MANDATORY)

1. **Write the plan** to `plans/` (inside a feature folder when it relates to a feature) with status `Draft`.
2. **Ask the user to review it.** Do not write any application code yet.
3. **Revise** the plan file when the user requests changes. Update the file, not just the chat.
4. **Wait for explicit approval.** Set the status to `Approved` only after the user approves.
5. **Implement** the approved plan, following all other `/docs` standards and using the plan's Change ID.
6. **Close out**: set the status to `Implemented` and record any deviations from the plan in the plan file.

Never implement a plan whose status is not `Approved`. If the scope changes during implementation, update the plan and get re-approval first.

## 6. Git Integration

- Plans are committed together with the implementation of the change.
- Do not commit automatically unless the user requests it.

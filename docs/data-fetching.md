# Data Fetching & Architecture Instructions

## 1. Core Architecture (CRITICAL)

All data access MUST follow Clean Architecture, SOLID principles, **Dependency Inversion**, and Separation of Concerns.

**The primary goal is to ensure that changes to low-level components (database, ORM, authentication provider, external services) do not require changes to high-level application or business logic.**

### Directory layout

```text
src/
  domain/        Entities, value objects, business rules (pure TypeScript)
  application/   Use cases + ports (repository / service interfaces) + DTOs
  data/          Infrastructure: Drizzle schema, DB connection, repository
                 implementations, auth adapters
  composition/   Server-only composition root: wires implementations to use cases,
                 resolves the authenticated user
  app/           Presentation: Next.js pages, layouts, Server Components, Server Actions
  components/    Presentation: UI components
```

### Dependency direction (source-code dependencies)

```text
Presentation   -> Application
Composition    -> Application, Infrastructure   (the ONLY place that knows both)
Infrastructure -> Application                   (implements its ports)
Application    -> Domain
Domain         -> nothing
```

Dependency rules (Dependency Inversion Principle):

- High-level modules (Domain, Application) MUST NOT depend on low-level implementations (Infrastructure).
- Both high-level and low-level modules MUST depend on abstractions. Abstractions (ports) are **owned by the Application layer**, and Infrastructure implements them.
- Dependencies MUST point inward toward Application and Domain.
- Prefer composition over inheritance.
- Follow the Single Responsibility Principle.
- Avoid unnecessary abstractions and excessive architectural complexity (see Section 11).

## 2. Server Components ONLY for Data Fetching (CRITICAL)

**ALL data fetching in this app MUST be done via Server Components.** Data MUST NOT be fetched via route handlers, via client components, or via any other mechanism. This is incredibly important.

- Server Components MUST call Application use cases, obtained from the composition module.
- Server Components MUST NOT query the database directly.
- Client Components MUST NOT fetch application data. This includes `fetch`, `useEffect`, SWR, React Query, and any other client-side mechanism.
- Route handlers (`route.ts`, `app/api/*`) MUST NOT be used to read application data for the UI.
- Server Components MUST pass fetched data to Client Components through props.
- Database access MUST occur only through Infrastructure repositories in `src/data/`.

### Mutations

Mutations use Server Actions. Server Actions:

- MUST call Application use cases and MUST NOT access the database directly.
- MUST validate input with Zod (or an equivalent schema library).
- MUST authenticate the caller and enforce ownership via the use case and repository.

## 3. Layer Responsibilities

### Domain Layer (`src/domain/`)

Contains pure business logic:

- Entities and value objects
- Business rules and domain validation
- Domain services

Rules:

- MUST NOT depend on Next.js, Drizzle, databases, or Infrastructure.
- Only create Domain entities when there are real business rules (see Section 11).

### Application Layer (`src/application/`)

Contains:

- Use cases and application services
- **Ports**: repository interfaces and external service interfaces
- DTOs and application contracts
- Authorization and business workflow orchestration

Rules:

- MUST depend on abstractions (ports), not concrete implementations.
- MUST own the port definitions. Infrastructure conforms to them, never the reverse.
- MUST NOT import Drizzle, database clients, or anything from `src/data/`.
- MUST NOT import Next.js request, cookie, header, or session APIs.
- MUST NOT instantiate concrete repositories.
- MUST be independently unit-testable with fake repositories.

### Infrastructure Layer (`src/data/`)

Contains:

- Drizzle ORM implementations and the database schema (`schema.ts`)
- Database connection and transaction management
- Repository implementations
- Authentication provider adapters
- External API adapters
- Persistence mappings (database row to domain entity / DTO)

Rules:

- All Infrastructure code lives in `src/data/`. `drizzle-orm` and the database client MAY be imported ONLY from this directory.
- MUST implement Application ports.
- MUST isolate database-specific logic.
- MUST NOT expose ORM-specific types (rows, query builders, SQL objects, schema tables) to Application, Domain, or Presentation.
- MUST NOT contain unrelated business rules.

### Composition Layer (`src/composition/`)

The single place where abstractions are bound to implementations.

Rules:

- MUST be server-only (`import "server-only"`).
- Constructs concrete repositories and injects them into use cases.
- Resolves the authenticated user from the verified session (see Section 7).
- Is the only module allowed to import both Application and Infrastructure.
- Exposes ready-to-use use cases to Presentation.

### Presentation Layer (`src/app/`, `src/components/`)

Contains:

- Next.js pages and layouts
- Server Components
- Client Components
- Server Actions

Rules:

- MUST obtain and invoke Application use cases through the composition module.
- MUST NOT contain database queries.
- MUST NOT implement business rules.
- MUST NOT import from `src/data/` directly.

## 4. Repository Pattern (MANDATORY)

All database access MUST be performed through repository implementations in `src/data/`.

Repository ports MUST be defined in the Application layer, independently of any database technology.

```ts
// src/application/workouts/workout-repository.ts  (the abstraction)
export interface WorkoutRepository {
  findAllForUser(userId: string): Promise<WorkoutDto[]>;
  findByIdForUser(id: string, userId: string): Promise<WorkoutDto | null>;
}
```

```ts
// src/data/workouts/drizzle-workout-repository.ts  (the implementation)
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/data/db";
import { workouts } from "@/data/schema";
import type { WorkoutRepository } from "@/application/workouts/workout-repository";

export class DrizzleWorkoutRepository implements WorkoutRepository {
  async findAllForUser(userId: string) {
    const rows = await db.select().from(workouts).where(eq(workouts.userId, userId));
    return rows.map(toWorkoutDto);
  }

  async findByIdForUser(id: string, userId: string) {
    const [row] = await db
      .select()
      .from(workouts)
      .where(and(eq(workouts.id, id), eq(workouts.userId, userId)));
    return row ? toWorkoutDto(row) : null;
  }
}
```

Rules:

- Use feature-specific repositories.
- Repository contracts MUST use domain or application types.
- Do not expose Drizzle query builders or SQL objects.
- Avoid generic repositories unless they provide genuine reuse.
- Repositories MUST enforce user ownership in database queries.
- Database implementation changes MUST NOT affect Application use cases when contracts remain unchanged.

## 5. Dependency Injection

Use constructor injection or function injection to provide dependencies. Use cases depend on ports, never on concrete classes.

```ts
// src/application/workouts/get-workouts.ts
export class GetWorkouts {
  constructor(private readonly repository: WorkoutRepository) {}

  async execute(userId: string) {
    return this.repository.findAllForUser(userId);
  }
}
```

```ts
// src/composition/workouts.ts  (the only place that knows the concrete class)
import "server-only";
import { GetWorkouts } from "@/application/workouts/get-workouts";
import { DrizzleWorkoutRepository } from "@/data/workouts/drizzle-workout-repository";
import { getAuthenticatedUserId } from "@/composition/auth";

export async function getWorkouts() {
  const userId = await getAuthenticatedUserId();
  return new GetWorkouts(new DrizzleWorkoutRepository()).execute(userId);
}
```

```tsx
// src/app/dashboard/page.tsx  (Server Component)
import { getWorkouts } from "@/composition/workouts";

export default async function DashboardPage() {
  const workouts = await getWorkouts();
  return <WorkoutList workouts={workouts} />;
}
```

Rules:

- Use cases MUST receive interfaces or structural contracts.
- Concrete implementations MUST be assembled only in `src/composition/`.
- Do not instantiate Drizzle repositories inside use cases or Presentation.
- Do not introduce a dependency injection framework unless necessary.
- Only trusted server-side code may provide authenticated user context.

## 6. Database Access Rules

Drizzle ORM is the required database implementation.

- **DO NOT USE RAW SQL.** All queries use Drizzle's typed query builder.
- All database queries MUST reside in Infrastructure (`src/data/`).
- Do not query the database inside Server Components, Server Actions, or use cases.
- The Drizzle schema lives in `src/data/` and MUST NOT be imported outside it.
- Map database records to domain entities or application DTOs before returning them.
- Keep database connection and transaction management centralized in `src/data/`.

## 7. User Data Isolation (CRITICAL)

**A logged-in user MUST ONLY access their own data.** They MUST NOT be able to access any other user's data. This is incredibly important.

Rules:

0. The authenticated `userId` is resolved ONLY in the server-only composition module, from the verified session. It is passed into use cases and repositories. Server Components and Server Actions MUST NOT read it from route params, search params, form data, or request bodies.
1. Resolve the authenticated user identity from a verified server-side session.
2. NEVER trust client-provided `userId` values for ownership.
3. Application use cases MUST enforce authorization.
4. Repository queries MUST enforce user ownership.
5. Queries by record ID MUST also filter by the authenticated owner ID.
6. Child records MUST verify ownership through their parent relationships (join or user-scoped filter).
7. Unauthenticated requests MUST NOT return protected data (throw or redirect).
8. Never expose another user's data through reads, updates, deletes, or error responses.
9. Authentication provider details (Clerk, Auth.js, etc.) MUST remain isolated behind an Application port with an adapter in `src/data/`.
10. Only trusted server-side entry points may construct or supply authenticated application context.

Example:

```ts
where(
  and(
    eq(workouts.id, workoutId),
    eq(workouts.userId, authenticatedUserId)
  )
)
```

## 8. Reusability and Abstraction

Shared low-level capabilities SHOULD be reusable across features.

Examples:

- Database connections
- Transaction management
- Pagination
- Filtering and sorting
- Logging
- Authentication adapters
- External API clients

Rules:

- Depend on abstractions at every boundary where an implementation may change (database, auth, external APIs, clock, logging).
- Prefer composition over inheritance.
- Avoid duplicating shared technical functionality.
- Do not introduce abstractions solely for hypothetical future requirements.
- Shared utilities MUST NOT create reverse dependencies (Infrastructure utilities must not import use cases).
- Keep business logic independent of technical implementation details.

## 9. Validation and Data Contracts

- Validate untrusted input at server boundaries using Zod or equivalent schemas.
- Enforce domain invariants inside the Domain layer.
- Return stable DTOs from Application use cases.
- Never expose sensitive database fields unnecessarily.
- Do not return ORM-specific objects to Presentation.
- Keep validation, authorization, and persistence responsibilities separate.

## 10. Testing and Maintainability

- Domain logic MUST be testable without databases or frameworks.
- Application use cases MUST support fake or mock repositories.
- Infrastructure repositories SHOULD have integration tests.
- User isolation SHOULD be covered by tests once a test runner is configured (none is configured yet).
- Dependency boundaries SHOULD be enforced through ESLint rules (for example, `no-restricted-imports` blocking `drizzle-orm` and `@/data/*` outside `src/data/` and `src/composition/`).
- Prefer small, cohesive modules with clearly defined responsibilities.

## 11. Pragmatism for Simple Features

Do not create unnecessary classes, interfaces, factories, or layers when a simpler implementation satisfies these rules.

- Simple reads may use a thin use case that calls the repository.
- Create Domain entities only when there are real business rules. Otherwise return Application DTOs.
- A typical simple feature needs no more than: a repository port, a Drizzle implementation, and a use case, wired in `src/composition/`.
- Never skip the repository port or the composition module. Those carry the Dependency Inversion boundary.

## 12. Implementation Guidelines for AI Coding Agents

Before implementing any feature:

1. Identify the Domain entities and business rules (if any).
2. Define the required Application use case.
3. Define the repository or service port in the Application layer.
4. Implement the Infrastructure adapter in `src/data/` using Drizzle.
5. Wire dependencies in `src/composition/`.
6. Invoke the use case from the Server Component or Server Action.
7. Validate authentication, authorization, and ownership.
8. Add appropriate tests where a test runner exists.

**Favor maintainability, replaceability, testability, and simplicity over architectural ceremony.**

## 13. Final Checklist

Before completing any data-related change:

- [ ] Data is fetched in a Server Component, not a route handler or client component.
- [ ] Presentation calls Application use cases through `src/composition/`.
- [ ] Application depends on ports it owns, never on `src/data/`.
- [ ] Domain remains framework-independent.
- [ ] Infrastructure in `src/data/` implements the Application ports.
- [ ] Database queries use Drizzle ORM, with no raw SQL.
- [ ] No direct database access from Presentation or Application.
- [ ] Authenticated identity comes from a trusted session, resolved in the composition module.
- [ ] Every user-owned query enforces ownership.
- [ ] DTOs hide persistence implementation details.
- [ ] Dependencies are injected rather than instantiated inside use cases.
- [ ] Low-level implementations can be replaced without changing business logic.
- [ ] No unnecessary abstractions or duplicated functionality.

**GOLDEN RULE: Business logic must remain independent of the database, ORM, authentication provider, and framework implementation details.**

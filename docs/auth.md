# Authentication Standards

## 1. Provider (CRITICAL)

**This app uses [Clerk](https://clerk.com) for ALL authentication.** Do not introduce any other auth mechanism (Auth.js, NextAuth, Neon Auth, custom sessions, hand-rolled JWTs, or password/cookie handling). Do not build custom sign-in, sign-up, or user-management forms or screens: use Clerk's components and hosted flows.

The package is `@clerk/nextjs`. Read the Next.js guide in `node_modules/next/dist/docs/` and the current Clerk docs before writing auth code, as versions of both have breaking changes from older examples.

## 2. Where Clerk Is Allowed

Clerk is a low-level detail. Per `docs/data-fetching.md`, business logic must not depend on it.

| Location | Clerk usage |
| --- | --- |
| `src/proxy.ts` | `clerkMiddleware` (request-level session handling and redirects) |
| `src/app/layout.tsx` | `ClerkProvider` and Clerk UI components (`SignInButton`, `SignUpButton`, `UserButton`, `Show`) |
| `src/data/auth/` | Adapters that implement Application ports, e.g. `ClerkSessionProvider` (`@clerk/nextjs/server` `auth()`) |
| `src/composition/auth.ts` | Constructs the adapter and exposes `getAuthenticatedUserId()` |
| `src/domain/`, `src/application/` | **NEVER.** Depend only on the `SessionProvider` port (`src/application/auth/session-provider.ts`) |

Rules:

- `@clerk/nextjs/server` MAY be imported only in `src/proxy.ts`, `src/data/auth/`, and (if unavoidable) server-only presentation code that needs Clerk-specific helpers. Never import it in Domain or Application.
- The `SessionProvider` port is owned by the Application layer. The Clerk adapter implements it. If auth is ever swapped, only the adapter changes.
- Adapters in `src/data/auth/` MUST start with `import "server-only"`.

## 3. Resolving the Current User (CRITICAL)

The authenticated `userId` is the Clerk user id. It is resolved in ONE place:

```ts
// src/composition/auth.ts
import "server-only";
import { redirect } from "next/navigation";
import { ClerkSessionProvider } from "@/data/auth/clerk-session-provider";

export async function getAuthenticatedUserId(): Promise<string> {
  const userId = await new ClerkSessionProvider().getUserId();
  if (!userId) redirect("/");
  return userId;
}
```

Rules:

- Server Components and Server Actions get the user id ONLY by calling `getAuthenticatedUserId()` from `@/composition/auth` (usually indirectly, via the composition functions that wrap use cases).
- The `userId` MUST be passed into use cases and repositories. Use cases and repositories MUST NOT call Clerk themselves.
- NEVER read the user id from route params, search params, form data, request bodies, cookies, or any client-supplied value.
- NEVER call `auth()`, `currentUser()`, or `useAuth()` to obtain an id for data access anywhere except through the adapter.
- Unauthenticated access to protected data MUST redirect (as above) or throw. It must never return empty or fallback data silently for another identity.
- User-owned database rows store the Clerk user id in a `userId` text column, and every query filters on it (see `docs/data-fetching.md` Section 7).

## 4. Middleware / Proxy

This Next.js version uses `src/proxy.ts` (not `middleware.ts`). It exports `clerkMiddleware` as the default export.

- Keep the `config.matcher` that skips Next.js internals and static files and always runs for `/api` and `/trpc` routes.
- Middleware is for coarse routing (e.g. redirecting a signed-in user from `/` to `/dashboard`). It is NOT the authorization boundary for data. Data access is protected by `getAuthenticatedUserId()` plus ownership-filtered queries, even for routes the middleware "protects".
- If route protection is added in the middleware (e.g. `auth.protect()` or `createRouteMatcher`), it is an additional layer and never a replacement for the checks in Section 3.

## 5. Sign-In / Sign-Up UI

- Use Clerk components only: `SignInButton`, `SignUpButton`, `UserButton`, `Show`, etc. Do not build custom auth forms.
- Sign-in and sign-up open in **modal** mode (`mode="modal"`) and redirect to `/dashboard` after success (`forceRedirectUrl="/dashboard"`).
- Show/hide UI by auth state with Clerk's `Show` component (`when="signed-in"` / `when="signed-out"`), wrapped in `Suspense` as in the root layout.
- `ClerkProvider` is mounted once, in `src/app/layout.tsx`. Do not add additional providers.
- Auth-state UI is for presentation only. Hiding a button is never a security control.
- Any other UI around auth follows `docs/ui.md` (shadcn/ui components only).

## 6. Environment Variables and Secrets

- Clerk keys live in environment files (`.env.local`), never in source code, comments, docs, logs, commits, or `CHANGELOG-AI.md`.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is the only Clerk value that may be exposed to the browser.
- `CLERK_SECRET_KEY` MUST stay server-side and MUST NOT be prefixed with `NEXT_PUBLIC_`.
- Do not commit `.env*` files containing real keys.

## 7. Mutations and Server Actions

- Every Server Action that reads or changes user data MUST authenticate the caller via `getAuthenticatedUserId()` (through the composition module) BEFORE doing anything else.
- Validate input with Zod after authentication. Do not accept a `userId` as an action argument.
- Authorization (ownership) is enforced by the use case and repository, not by the action alone.

## 8. Route Handlers and Webhooks

- Route handlers MUST NOT be used to fetch application data for the UI (`docs/data-fetching.md` Section 2).
- If a Clerk webhook is ever needed (e.g. user deletion cleanup), it MUST verify the Clerk signature before processing, call an Application use case, and never trust the payload otherwise.

## 9. Testing

- Application use cases are tested with a fake `SessionProvider` / fake `userId`, never with Clerk.
- Do not call Clerk's real API from automated tests.

## 10. Final Checklist

Before completing any auth-related change:

- [ ] Clerk is the only authentication mechanism used.
- [ ] Clerk imports exist only in `src/proxy.ts`, `src/app/layout.tsx` (UI), and `src/data/auth/` (plus the composition wrapper via the adapter).
- [ ] Domain and Application layers have no Clerk imports and depend only on the `SessionProvider` port.
- [ ] The user id comes from `getAuthenticatedUserId()` in `src/composition/auth.ts`, never from client input.
- [ ] Unauthenticated access redirects or throws, and never returns data.
- [ ] Every user-owned query is filtered by the authenticated user id.
- [ ] No custom auth forms; Clerk components are used.
- [ ] No secrets in source, docs, or logs; `CLERK_SECRET_KEY` is not exposed to the client.
- [ ] Middleware is not relied on as the sole protection.

**GOLDEN RULE: Clerk authenticates the user; the composition layer resolves the identity; everything else only receives a verified `userId`.**

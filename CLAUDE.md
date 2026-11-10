# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation First (MANDATORY)

**ALWAYS refer to the relevant docs file in the `/docs` directory BEFORE generating any code.** The `/docs` files define the coding standards for this project and take precedence over general knowledge or defaults. Read the matching file(s) first, then write code that follows them.

- `docs/ui.md` — UI coding standards (shadcn/ui components only, no custom components; date-fns date formatting). Read before writing or changing any UI code.
- `docs/data-fetching.md` — Data fetching and architecture standards (Server Components ONLY; Clean Architecture with dependency inversion, repositories in `src/data/` using Drizzle, NO RAW SQL; users can only access their own data). Read before writing or changing any data fetching or database code.

- `docs/solid.md` — SOLID principles (MUST be strictly followed; project-specific good/bad examples for SRP, OCP, LSP, ISP, DIP; new-feature workflow and review checklist). Read before writing or changing any code.

- `docs/data-mutations.md` — Data mutation standards (writes ONLY via Drizzle helper functions in `src/data/`; mutations ONLY via Server Actions in colocated `actions.ts` files; typed params, NEVER `FormData`; ALL args validated with Zod). Read before writing or changing any mutation or Server Action.

- `docs/auth.md` — Authentication standards (Clerk ONLY; Clerk isolated behind the `SessionProvider` port, user id resolved only via `getAuthenticatedUserId()` in `src/composition/auth.ts`; Clerk components only, no custom auth forms). Read before writing or changing any auth-related code.

- `docs/change-tracking.md` — AI change tracking standards (unique `CHG-YYYYMMDD-NNN-FEATURE-NAME` Change IDs, code comments, `CHANGELOG-AI.md` entries, end-of-task summary). Read before modifying any code.

- `docs/planning.md` — Planning standards (ALL plans must be saved in the `plans/` folder, in a `plans/<feature-name>/` subfolder when feature-related, with a Change ID and an Architecture section; the user must approve a plan before implementation). Read before planning or implementing any task.

When new files are added to `/docs`, list them here.

## Status

Fresh Create Next App scaffold (single initial commit, no app logic yet). Update this file as real architecture emerges.

## Commands

- `npm run dev` — start dev server (Turbopack)
- `npm run build` / `npm run start` — production build / serve
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, uses `eslint-config-next`)
- No test runner is configured.

## Stack and conventions

- Next.js 16.4.6, React 19.3, TypeScript (strict), Tailwind CSS 4 (`@tailwindcss/turbopack`).
- App Router under `src/app/`. Path alias `@/*` → `src/*`.
- `AGENTS.md` warns this Next.js version has breaking changes from what you may know: read the relevant guide in `node_modules/next/dist/docs/` (start at `index.md`) before writing Next.js code, and heed deprecation notices.
- Root layout uses the globally available `LayoutProps<"/">` type helper (no import needed) rather than hand-written props types; fonts (Geist, Geist Mono) are wired via `next/font/google` CSS variables.

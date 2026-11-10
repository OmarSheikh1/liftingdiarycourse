# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation First (MANDATORY)

**ALWAYS refer to the relevant docs file in the `/docs` directory BEFORE generating any code.** The `/docs` files define the coding standards for this project and take precedence over general knowledge or defaults. Read the matching file(s) first, then write code that follows them.

- `docs/ui.md` — UI coding standards (shadcn/ui components only, no custom components; date-fns date formatting). Read before writing or changing any UI code.
- `docs/data-fetching.md` — Data fetching and architecture standards (Server Components ONLY; Clean Architecture with dependency inversion, repositories in `src/data/` using Drizzle, NO RAW SQL; users can only access their own data). Read before writing or changing any data fetching or database code.

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

# UI Coding Standards

These standards apply to all UI code throughout this project.

## Components: shadcn/ui ONLY

- **ONLY [shadcn/ui](https://ui.shadcn.com) components may be used for the UI in this project.**
- **ABSOLUTELY NO custom components may be created.** Do not write bespoke buttons, cards, inputs, modals, layouts, or any other reusable UI component.
- If you need a UI element, find the matching shadcn/ui component and use it as-is. If one is not installed yet, add it with the CLI:

  ```bash
  npx shadcn@latest add <component>
  ```

- Compose pages by combining shadcn/ui components directly (e.g. `Card`, `Button`, `Dialog`, `Input`, `Select`, `Calendar`). Style them only through their supported props/variants and Tailwind utility classes.
- Components generated into `src/components/ui/` by the shadcn CLI are the only components permitted in that directory. Do not hand-author new files there or modify them beyond what the CLI produces.

## Date Formatting

- All date formatting MUST be done with [date-fns](https://date-fns.org). Do not use `toLocaleDateString`, `Intl.DateTimeFormat`, `moment`, `dayjs`, or manual string building.
- Dates are displayed in the format: ordinal day, abbreviated month, full year.

  | Output       |
  | ------------ |
  | 1st Sep 2025 |
  | 2nd Aug 2025 |
  | 3rd Jan 2026 |
  | 4th Jun 2024 |

- Use the format string `"do MMM yyyy"`:

  ```ts
  import { format } from "date-fns";

  format(new Date(2025, 8, 1), "do MMM yyyy"); // "1st Sep 2025"
  ```

# AI-Generated Code Change Tracking Standards

## Purpose

All AI-assisted code generation and modifications must be traceable to a clearly identified development task.

These standards apply to every implementation, refactoring, bug fix, or enhancement made with Claude Code in files matching `**/*.ts`, `**/*.tsx`, `**/*.js`, `**/*.json`, `**/*.yaml`, `**/*.yml`, `**/*.http`.

## 1. Change Identification

Before modifying any code:

1. Determine the purpose of the requested change.
2. Assign a unique Change ID using this format:

   `CHG-YYYYMMDD-NNN-FEATURE-NAME`

3. Use the same Change ID across every file modified for the task.
4. Never reuse a Change ID for an unrelated task.
5. If the user supplies a Change ID, use it unchanged.
6. If uniqueness cannot be verified (check `CHANGELOG-AI.md`), ask for a Change ID rather than guessing.

Example:

`CHG-20261106-001-WORKOUT-CRUD`

## 2. New Code Comments

Add a short comment identifying the change at the beginning of each significant new logical section.

For TypeScript/JavaScript:

```ts
// CHG-20261106-001-WORKOUT-CRUD
// Purpose: Implements workout creation and validation.
export async function createWorkout(input: CreateWorkoutInput) {
  // Implementation
}
```

For JSX/TSX:

```tsx
{/* CHG-20261106-001-WORKOUT-CRUD
    Purpose: Displays workout information. */}
```

Use the appropriate comment syntax for the language (JSON files do not support comments; track those in `CHANGELOG-AI.md` only).

Do not add change comments to every statement, property, or line.

## 3. Modified Existing Code

When changing an existing function or component:

- Preserve existing comments where they remain accurate.
- Add a Change ID comment immediately above the modified function or logical section.
- Explain the purpose of the modification.
- Avoid comments that merely repeat what the code does.

Example:

```ts
// CHG-20261106-001-WORKOUT-CRUD
// Change: Added validation before creating a workout.
export async function createWorkout(input: CreateWorkoutInput) {
  // Implementation
}
```

## 4. Change Log

Maintain a repository-level file:

`CHANGELOG-AI.md`

For each development task, add one entry containing:

- Change ID
- Change name
- Date
- Purpose
- Prompt or task description
- Files created
- Files modified
- Important architectural decisions
- Testing and build results

Use the same Change ID as the source-code comments.

## 5. Change Summary

After completing a task, report:

1. Change ID and change name.
2. Files created.
3. Files modified.
4. Main changes made.
5. Build and test results.
6. Any unresolved issues.

## 6. Existing Code

Do not add Change IDs to unrelated existing code.

Only annotate code that is newly created or materially modified as part of the current task.

## 7. Code Quality

- Keep comments concise and meaningful.
- Never add comments containing credentials or sensitive data.
- Do not replace useful documentation with change tracking comments.
- Avoid excessive comments that reduce code readability.
- Never modify unrelated code solely to add tracking comments.
- Preserve existing functionality unless the task explicitly requires changing it.

## 8. Git Integration

When Git is available:

- Include the Change ID in the proposed commit message.
- Do not commit automatically unless requested.
- Use Git diffs to identify modified files and verify the change scope.
- Never overwrite or discard unrelated uncommitted changes.

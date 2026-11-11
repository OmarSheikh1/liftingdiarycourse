// PostToolUse hook (matcher: Write).
// When a NEW file is created inside the project's docs/ directory, remind Claude
// to run the docs-index-updater agent so CLAUDE.md's documentation list stays in sync.
const path = require("path");

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);
    const filePath = input?.tool_input?.file_path;
    if (!filePath) return;

    // Skip overwrites of existing files; only react to newly created ones.
    const resultType = input?.tool_response?.type;
    if (resultType && resultType !== "create") return;

    const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    const rel = path.relative(projectDir, path.resolve(projectDir, filePath));
    const parts = rel.split(path.sep);
    if (parts[0] !== "docs" || parts.length < 2) return;

    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext:
            `A new file was added to the docs directory (${parts.join("/")}). ` +
            "Use the docs-index-updater agent to add it to the documentation list in CLAUDE.md.",
        },
      })
    );
  } catch {
    // Never block or break the tool call on hook errors.
  }
});

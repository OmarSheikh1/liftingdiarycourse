Commit any changes in the current branch and provide a suitable commit message based on the code changes.

Arguments: `$1` = target branch to merge into, `$2` = name of the new branch to create.

If `$2` (the new branch name) is NOT provided, stop after the commit: do NOT merge and do NOT create a new branch. Never ask the user for a branch name.

If `$2` is provided, continue with the following steps:

1. Merge the current branch into the `$1` branch and resolve any issues that arise from the merge. If `$1` is missing, ask the user which branch to merge into.
2. Create a new branch called `$2`.

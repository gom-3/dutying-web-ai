# Develop to main promotion — 2026-10-20

The user requested promotion of current develop to the production branch (named main in all three repositories). Preserve main-only fixes and retain develop ancestry. This change promotes source only; [skip ci] prevents automatic uncoordinated deployment. No budget increase, database access, migration replay, or .net changes.

Actual runtime deployment remains a separate coordinated operation and is not claimed by this merge. Consumers must support catalog plans before the LLM catalog producer is activated; priority receiver compatibility must also be established. Paid model quality evaluation remains outstanding.

Application/test/workspace source matches validated develop; retain existing release history and prepare remaining approved changesets with repository release scripts. The preceding full Vitest run passed 2355 cases (3 skips), with two load-related UI timeouts passing unchanged on isolated recheck (5/5). Production build and TypeScript checks passed before promotion.

Release version: 1.3.7. Remaining develop changesets are consumed; release notes distinguish newly promoted changes from earlier main releases. After versioning, validate changeset status against the committed release HEAD rather than the stale local develop reference. No empty changeset is retained (the repository changelog parser does not support it).

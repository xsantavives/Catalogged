# Catalogged — Development and QA

## Standard execution
1. Read root AGENTS.md, the linked Notion product decision and this contract; inspect repo, active PRs and current Linear bet.
2. Confirm a single owner, one accepted issue, allowed paths, non-goals, exact acceptance evidence and a worktree dedicated to the task.
3. Implement one complete vertical slice, never a mock presented as integration.
4. Run the commands below and relevant scoped tests; record full commands, results, exact commit SHA and known gaps.
5. Open a draft PR using .github/pull_request_template.md; independent agent reviews from its own checkout and produces concrete test evidence.
6. Merge only with green applicable CI, resolved findings and an authorized acceptance decision. Never equate passing synthetics with commercial or production GO.
7. Link accepted PR/deployment in Linear, measure lead time and defect escapes.

## Checks (current and/or required)
npm ci; npx prisma generate; npm run typecheck && npm run lint && npm test && npm run build; git diff --check. Authenticated Shopify smoke, production migration and real merchant incident require separate verified evidence.

## Pilot metrics (two 2-week cycles from 2026-11-02)
- PR ready → independent decision elapsed time.
- Linear Ready → accepted merge elapsed time (and blocked time separately).
- CI failure/flake rate, post-merge P0/P1 and reverted changes.
- Number of slices actually accepted with user/commercial evidence.
Use exact timestamps and never invent improvement percentages or success outcomes.

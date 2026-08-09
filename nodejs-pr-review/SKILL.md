---
name: nodejs-pr-review
description: "Review pull requests in the nodejs/node (or any GitHub) repository and produce beginner-friendly HTML code-review reports. Use when the user asks to (1) review the latest or open PRs in nodejs/node, (2) analyze PR diffs and assess merge readiness, (3) explain what a batch of PRs does to newcomers, or (4) generate an HTML dashboard with charts summarizing code reviews. Data fetching is read-only: never comment, approve, label, or otherwise mutate GitHub."
---

# Node.js PR Review

## Workflow

1. **Prepare the workspace.** Create a working directory (e.g. `pr-reviews/`). If `exec_command` fails with `bwrap: Unexpected capabilities...`, run commands with `require_escalated` and a short justification; the sandbox may be broken in this environment.
2. **Fetch PR data (read-only).**
   ```bash
   scripts/fetch_pr_data.sh --repo nodejs/node --count 10 --out data
   ```
   Default API base is `https://api.github.com`. In a Sprite environment, pass the read-only API gateway URL (`--api https://api.sprites.dev/v1/gateway/github/<conn-id>`) to avoid rate limits. Only GET endpoints are used.
3. **Write `reviews.json`.** Add one entry per PR number with a plain-language summary, key changes, findings, verdict, and beginner notes. Schema, verdicts, and severities: see `references/review_guide.md`.
4. **Review each PR.** Read `data/pr_<N>.json`, `data/pr_<N>_files.json` (contains per-file patches), `data/pr_<N>_reviews.json`, `data/pr_<N>_comments.json`, `data/pr_<N>_issue_comments.json`, and `data/pr_<N>_checks.json`. Use the local nodejs checkout when available to verify call sites; otherwise fetch base-version files with the API using the PR's `base.sha`. Follow the per-category checklist in `references/review_guide.md`.
5. **Generate the HTML report.**
   ```bash
   scripts/generate_report.js --data data --reviews reviews.json --out .
   ```
   Writes `index.html` and `pr-<N>.html` with inline SVG charts (no network needed) and copies `assets/style.css` into `out/assets/`.
6. **Validate.** Open `index.html`, confirm every `pr-<N>.html` exists, internal links resolve, and HTML parses without unclosed tags. Verify GitHub PR URLs and `#NNNN` references render as clickable links.

## Rules

- GitHub access is read-only (GET only). Never post comments, reviews, labels, or push.
- "Latest PRs" means open PRs sorted by `created` desc (the GitHub `/pulls` default). State this assumption in the report.
- Use these verdicts: `approve`, `approve-with-nits`, `discuss`, `needs-changes`. Use `discuss` for drafts or duplicate proposals.
- Findings use severities `high`, `medium`, `low`, `nit`, `info`, each with a concrete suggestion.
- Every PR page targets beginner Node.js core developers: include a plain-language explanation, key changes, files, findings, CI state, and a short glossary.
- Back every finding with evidence (file/line/behavior). When a refactor deletes code, compare semantics against the base version before calling it equivalent.
- Report CI per PR (success/failure/pending/skipped) and let red CI influence the verdict.

## Resources

- `references/review_guide.md` — detailed per-category review checklist, common regression patterns, verdict taxonomy, and `reviews.json` schema. Read it before writing findings.
- `scripts/fetch_pr_data.sh` — read-only GitHub data fetcher.
- `scripts/generate_report.js` — HTML report generator with SVG charts.
- `assets/style.css` — report stylesheet, copied into the output directory.

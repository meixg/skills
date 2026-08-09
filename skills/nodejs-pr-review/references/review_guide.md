# Review Guide

## Contents

1. Review goals and audience
2. Data layout produced by `fetch_pr_data.sh`
3. `reviews.json` schema
4. Verdict taxonomy
5. Finding severity definitions
6. Per-category checklists
7. Common regression patterns in nodejs/node PRs
8. Report requirements

## 1. Review goals and audience

The deliverable is a per-PR code review plus a beginner-friendly HTML report. Treat each PR review as a
merge-readiness assessment: correctness, regression risk, test coverage, and CI state. The report must be
readable by developers who are new to Node.js core, so every page needs plain language and a glossary.

## 2. Data layout produced by `fetch_pr_data.sh`

All files live under the `--out` directory (default `data/`):

- `pr_list.json` — PR list (number, title, state, created_at, head/base, user, draft)
- `pr_<N>.json` — PR metadata, including `base.sha`, `head.sha`, body
- `pr_<N>_files.json` — per-file changes; each item has `filename`, `status`, `additions`, `deletions`, and `patch` (unified diff)
- `pr_<N>_reviews.json` / `pr_<N>_comments.json` — submitted reviews and inline review comments
- `pr_<N>_issue_comments.json` — issue/PR thread comments (bot CI messages included)
- `pr_<N>_commits.json` — commit list (useful for summarizing multi-commit PRs)
- `pr_<N>_checks.json` — CI check-runs with `conclusion` (success/failure/skipped/null=in progress)

## 3. `reviews.json` schema

```json
{
  "meta": { "repo": "nodejs/node", "fetched_at": "YYYY-MM-DD", "note": "..." },
  "reviews": {
    "65159": {
      "category": "src-core | sqlite | deps | test",
      "categoryLabel": "human label",
      "verdict": "approve | approve-with-nits | discuss | needs-changes",
      "verdictLabel": "short Chinese label",
      "verdictNote": "one-paragraph conclusion",
      "summaryZh": "technical summary",
      "plainLanguage": "beginner explanation",
      "whyItMatters": "why this PR matters",
      "keyChanges": [{ "title": "...", "detail": "..." }],
      "findings": [{ "severity": "high|medium|low|nit|info", "title": "...", "detail": "...", "suggestion": "..." }],
      "ciNote": "CI summary text",
      "beginnerNotes": ["glossary item 1", "..."]
    }
  }
}
```

## 4. Verdict taxonomy

- `approve` — no blocking issues; mechanical or low-risk changes (test syncs, small dependency bumps).
- `approve-with-nits` — mergeable, but note non-blocking suggestions (message wording, coverage, CI to watch).
- `discuss` — direction is open: drafts, duplicate proposals, or vendor updates carrying suspicious upstream code.
- `needs-changes` — concrete bugs, regressions, red CI, or unsafe refactors must be fixed first.

## 5. Finding severity definitions

- `high` — behavior regression, crash, security boundary issue, or definite bug in shipped code paths.
- `medium` — likely incorrect in edge cases, or significant risk without test coverage.
- `low` — edge-case mismatch, CI failure to verify, or missing test/coverage for a risky change.
- `nit` — style, wording, or error-message polish.
- `info` — positive confirmation, scope notes, or related out-of-scope issues to track.

## 6. Per-category checklists

### src-core (C++ / src/)

- Read the PR body and commits to understand intent before reading the diff.
- Verify every call site of changed APIs/classes: compile-safety and behavior (e.g., array length passed to `Array::New` must equal the filled count, not the allocated capacity).
- For `v8::Local<T>` storage, confirm handles never live in `malloc`'d memory; `v8::LocalVector` is the correct dynamic container.
- Compare V8 Fast API paths with slow paths: identical return/exception behavior for edge inputs (unknown scope, failed `ToString`, empty strings).
- For refactors that remove classes (e.g., permission classes), diff the base version and confirm `Apply`/`Drop`/`is_granted` semantics are preserved.
- Check snapshot code paths (`IsolateData::Serialize`/`Deserialize`) when new persisted strings/templates are added.
- Flag formatting/CI issues (`lint-cpp`, `make format-cpp`).

### sqlite (src/node_sqlite.*)

- `sqlite3_prepare_v2()` can return `SQLITE_OK` with a NULL `sqlite3_stmt*` for comment-only/empty SQL; guard before any use of the statement.
- Decide where to reject invalid input: at prepare time (avoids caching bad statements) vs execution time (minimal change). Note duplication when multiple PRs fix the same issue.
- Authorizer callbacks must not modify the connection that invoked them; verify RAII guards decrement on every exit path (exception-safe), and check all entry points: database methods, statements, iterators, tag stores.
- Error codes/messages should match existing conventions (`ERR_INVALID_STATE`, `ERR_INVALID_ARG_VALUE`, `ERR_SQLITE_ERROR`).
- New behavior is allowed without deprecation because `node:sqlite` is Stability 1.2, but say so in the review.

### deps (deps/ updates)

- Confirm the vendored version bump matches `versions.json`-style headers (e.g., `src/undici_version.h`) and build integration (`node.gyp`).
- Summarize meaningful upstream changes that reach Node.js users (new options, deprecations, retry budgets, parser fixes).
- Spot-check suspicious upstream code that will ship verbatim (e.g., validation typos, inconsistent option fields). Verify against upstream before blocking, but always flag it.
- Note ABI/soname changes for shared-lib scenarios and recommend running the dependency's own testsuite on target architectures.
- CI green is expected for mechanical bumps; treat failures as blocking until explained.

### test / WPT

- WPT syncs update `test/fixtures/wpt/versions.json` and fixture files; check the WEB_FEATURES.yml format matches upstream conventions.
- CI failures on test-only PRs are usually flakes; ask to re-run and compare with main.
- New upstream assertions (e.g., key-length checks) may expose real implementation bugs — note whether CI passed.

## 7. Common regression patterns in nodejs/node PRs

- **Partial-fill buffers**: allocating `N` slots but filling `M < N`, then creating an array from the buffer's length. Symptom: extra empty entries. Fix: set length to `M` or pass explicit count.
- **Fast/slow path divergence**: V8 Fast API callbacks silently returning `false` where the slow path throws.
- **Refactor claims "equivalent"**: removed classes/maps often differ subtly (default states, per-scope behavior). Always diff base semantics.
- **Cache pollution**: invalid objects cached and reused (e.g., NULL sqlite statements) — fix at creation time, not use time.
- **RAII ordering**: depth counters incremented but not decremented on early returns; prefer scope guards.
- **Snapshot drift**: new persistent data added to `Serialize` but mishandled in `Deserialize` (empty `Local`).

## 8. Report requirements

`scripts/generate_report.js` produces:

- `index.html` — verdict donut, per-PR added/deleted lines, file-area distribution, CI stacked bars, overview table, beginner guide.
- `pr-<N>.html` — hero (title, badges, clickable GitHub URL), plain-language explanation, summary, key changes, files table + bars, findings with severity badges, verdict, CI state, glossary.

Charts are inline SVG; no external resources. GitHub URLs and `#NNNN` references must be clickable
(`target="_blank" rel="noopener"`). Add a disclaimer that the review is a local read-only analysis and
does not replace maintainer review, and note the data snapshot time.

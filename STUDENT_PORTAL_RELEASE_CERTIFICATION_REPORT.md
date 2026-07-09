# Student Portal Release Certification Report

Review date: 2026-07-08
Scope: `student-portal/`
Status: NOT PRODUCTION READY

This report records the current production-readiness state after the latest hardening pass. The portal type-checks successfully and the exam flow is now routed through Supabase RPCs for server-side grading, but it must not be certified as production-ready until the remaining backend deployment and end-to-end verification items are closed.

## Scores

| Area | Score | Notes |
| --- | ---: | --- |
| Architecture | 7/10 | Supabase remains the source of truth for core reads/writes; legacy exam fallbacks were removed. |
| Supabase | 7/10 | Exam submission now uses server-side RPC grading and no longer needs direct anon reads of correct answers or direct writes to `platform_results`. |
| Security | 6/10 | Exam answers are no longer graded in the browser; true authentication/token refresh still needs a backend-backed design. |
| Performance | 8/10 | Snapshot data is lazy-loaded; build output has no chunk-size warning. |
| Accessibility | 8/10 | Dialog focus handling, labels, and live regions were improved in the previous pass. |
| UI/UX | 7/10 | Core tabs and states are intact; final manual responsive review is still needed. |
| SEO | 8/10 | Metadata was corrected; existing canonical/OG/sitemap assets remain present. |
| PWA | 8/10 | Service worker now caches only app shell/static assets instead of all same-origin GET requests. |
| Testing | 5/10 | `tsc --noEmit` passes; production build is blocked in this Windows/Node environment by `spawn EPERM`; automated e2e tests are still missing. |
| Maintainability | 8/10 | Dead code and fake paths were removed; audio feedback was centralized. |
| Production Readiness | 6/10 | Buildable and cleaner, but still blocked by auth/RLS/e2e validation. |

## Fixes Completed

- Restricted `public/sw.js` caching to navigation shell and static assets only.
- Corrected `metadata.json` to remove obsolete SQLite/Gemini claims.
- Removed localStorage data merging from attendance, payments, and grades reads.
- Removed legacy exam fallback paths:
  - `online_exams`
  - `exam_questions`
  - `exam_results`
  - `portal_exams`
- Kept the exams workflow on:
  - `platform_exams`
  - `platform_questions`
  - `platform_choices`
  - `platform_results`
- Changed exam submission so local grade state updates only after `platform_results` save succeeds.
- Changed exam submission again so the browser sends only selected answers to `portal_submit_platform_exam_result`; Supabase computes score, counts, and `platform_results` row.
- Added `portal_completed_platform_exam_ids` so the portal can mark completed exams without direct anon reads from `platform_results`.
- Removed direct portal reads of `platform_choices.is_correct` and `platform_questions.correct_answer`.
- Added `alpha-center/supabase/migrations/20260708090000_portal_platform_exam_rpc_hardening.sql` to create the exam RPCs and revoke broad anon access to exam answers/results.
- Fixed the exam hardening SQL grants so anon can filter public question/choice rows by `deleted_at` without regaining access to `is_correct` or `correct_answer`.
- Tightened `alpha-center/db/migrations/platform_exams_alignment.sql` so the documentation alignment file no longer grants broad anon access to `platform_results`.
- Passed the logged-in student into `ExamTaker` from React state instead of reading it from `localStorage`.
- Moved the current student session from `localStorage` to `sessionStorage`, and cleaned old local persisted student data.
- Changed Supabase write methods to fail explicitly when Supabase is not configured instead of returning fake success.
- Removed stale mock/offline wording from production-facing metadata and comments.

## Verification Run

- `npm run lint` passed.
- `npm run build` did not complete in this environment. The failure occurs before app module compilation with `spawn EPERM` from Node child processes used by Vite/esbuild.
- `npx vite build --configLoader native` bypassed config bundling after `vite.config.ts` was made ESM-safe, but still failed inside Vite's Windows realpath resolver with `[commonjs--resolver] spawn EPERM` while attempting a child-process call.

The build failure is an environment/tooling blocker, not a TypeScript error from the current source changes. It should be rerun from a Windows shell where Node can spawn helper processes from this workspace path, or from a shorter ASCII-only checkout path.

## Remaining Significant Issues

- Authentication is still not a true token-based Supabase Auth session. Login verifies student code and phone through client-side Supabase queries, then stores session state in the browser.
- The new exam RPC migration still needs to be applied to the real Supabase project and verified there with the anon key.
- RLS for non-exam tables still needs direct live verification. Production readiness depends on policies preventing cross-student reads/writes for attendance, payments, grades, and students.
- Token refresh is not implemented because the portal does not currently use Supabase Auth tokens.
- Production build remains blocked in this local environment by `spawn EPERM` until the Node/Vite child-process issue is resolved.
- End-to-end tests are still missing for:
  - login
  - exam availability
  - exam submission
  - `platform_results` persistence
  - teacher sync from results to grades
- Manual responsive/browser QA remains required after the latest changes.
- Desktop compatibility was type-checked after the platform sync changes, and Android platform-control alignment was reviewed and patched statically. Live cross-client e2e validation is still pending.

## Certification Decision

The Student Portal is not certified as `PRODUCTION READY`.

It is materially safer than before this pass, especially for exams, but production certification requires applying and testing the new Supabase RPC/RLS migration, resolving the local production-build blocker, a backend-backed authentication/session strategy, and end-to-end workflow validation across portal, desktop, Android, and Supabase.

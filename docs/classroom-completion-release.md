# Classroom demo completion — 0.42.0

This release closes the remaining day-to-day organisation gaps in the agreed browser demo. It is not a claim of full Google Classroom, Teams or Moodle feature parity.

## Final additions

- Classwork: search title, topic and instructions; combine topic and role-specific status filters; ten tasks per page; preserve course-unit scope and filter links. Students still receive only released, assigned, unlocked work. Teachers can find drafts and work awaiting marking.
- Stream: create, edit, pin, search, archive and restore announcements; six per page; revision checks and scoped audit. Archived items disappear from student rooms and updates. Edits/restores surface as new update versions. Nothing is emailed.
- My reading: student-only, twelve materials per page across enrolled subjects; class, status and text filters; current-version confirmation and updated-reading counts. Confirmation still happens on the material page, never automatically from a link click.
- Role-aware Help: short teacher and student quick starts within Classroom, including the separate MIS transfer and the browser demo boundary.

## Existing classroom workflows retained

Roster and login integration; Today and weekly planner; course units with prerequisites and release rules; unit copy and publication plans; assignments and 39 quiz/content types including matching, maths, missing words and Additional activities; teacher/student file attachments; draft autosave and hand-in; rubrics, per-question feedback and private marking drafts; returned feedback and revision history; explicit selected-score MIS transfer; grade trends, objective analysis and targeted practice; library and question bank; private help; moderated discussions; portfolios and explicitly shared family views; materials edit/copy/archive, reading confirmations and filtered CSV reports.

## Verification

352 automated tests pass, including new HTTP role checks, stale announcement writes, archive visibility, unread-version changes, own-reading aggregation, class scoping and classwork filtering/paging. Syntax checks pass. Local browser QA created and revised a pinned announcement, archived/restored it, searched Classwork, drafted/published a two-question quiz, saved/handed in as Alex Ellis, returned 3/3 as Noah Morgan, verified the MIS was unchanged before explicit transfer, then transferred and saw Already matches. Student My reading opened a CPU guide and cleared it from outstanding reading after confirmation.

## Demo boundary

The existing integrated browser database namespace and all saved test records are preserved. Public fixture logins remain deliberate demonstrations, not production authentication. Records are local to a browser and do not synchronise between testers. No billing, third-party account connections, live document co-editing, external email/push notifications, offline synchronisation or production school service was enabled. These require a separate shared-service deployment.

Published verification: the Learning Hub release was checked for teacher Stream creation/pinning, Classwork search, student My reading and both role-aware Help pages. Proof images and the verification record are under output/.

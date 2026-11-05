# Learning workflow release 0.20

Built around teachers' and students' daily tasks. The existing browser demo database namespace is preserved; no paid infrastructure or external assessment integration was introduced.

## Included
- Role-scoped Today dashboard with next action, outstanding work, feedback, and the active MIS timetable.
- Compact marking inbox across classes: needs marking, resubmitted, missing, ready for explicit MIS transfer.
- Reusable immutable assessment snapshots and question banks, private or shared within curriculum areas. Copies start as editable drafts with a fresh ID and cleared deadlines/student targeting.
- Visual rubric builder, criterion-level marking, reusable feedback comments and per-question feedback.
- Student feedback acknowledgement, optional reflection, and three earlier returned versions. Mark changes also leave a scoped audit record.
- Student draft autosave (1.4 second debounce) with visible saved/error states and revision conflict protection. Explicit hand-in waits for an in-flight save.
- Objectives on questions, student evidence summaries, class question analysis and targeted practice drafts for reviewed results below 60%.
- Scheduled release, selected-student assignment, private individual deadlines, estimated work time and a homework workload check.
- Advanced settings are collapsed. Long Today lists show six tasks initially, with the rest explicitly expandable. Automatically scored answers are collapsed in teacher review; questions requiring marking open initially.

## Validation
231 tests passed with syntax checks. Browser QA created/published a rubric assignment, saved it to the library, copied it to a second class as a draft, autosaved and submitted student work, marked and returned the rubric without MIS transfer, acknowledged feedback, and saved/reinserted an objective-tagged question through Bank.

## Deliberately separate next stages
Parent accounts, shared multi-device persistence, live document collaboration, offline sync, course sequencing, portfolios, discussion moderation and more extensive accessibility/primary presentation work remain future releases. The current deployment is still a fictional, browser-local demo. No billing account changes were attempted.

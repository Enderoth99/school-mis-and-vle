# Class progress and learning paths — 0.25.0

Teachers open **Classroom → Progress → Class overview** to compare unit progress across their current class roster. Cells distinguish ready, in progress, handed in, complete, overdue, locked and scheduled work. Filters identify overdue tasks, work awaiting marking, current drafts/revisions and completed units. Search accepts names or numeric student IDs. Four units and twelve students are shown per page. Summary counts refer to the full class. CSV export contains all students matching the current filters and all units, with spreadsheet formula protection.

Clicking a student or a unit cell opens the individual learning path, with links to the unit material and the correct student’s assignment review. Question-level analytics remain under **Question insights**. Selected unit material now opens on its own page, with a link back to all course units.

Students open **My progress → Learning path**. Their next step prioritises unread feedback, overdue tasks and saved drafts, then available reading or classwork. Counts and statuses reuse the saved Classroom submissions, reading confirmations, prerequisites, release rules and individual deadlines. Handed-in work does not require a passing grade to count as unit completion; this is explicitly explained in the interface. Revising previously returned work retains the existing unit-completion semantics and is labelled accordingly.

This feature is read-only and does not change submissions, grades or MIS transfers. Students cannot see class matrices, peers’ progress, unpublished task titles, answers or marking keys. Staff remain limited to their allocated classes and current student memberships; family accounts cannot use Classroom endpoints.

Validation: 275 tests and syntax checks pass. Browser QA verified student path navigation, next-step links, draft continuation, hand-in, teacher progress changes and filters, direct assignment-review links, selected unit material and an actual filtered CSV download. Public hosting retains the existing browser-local demo database. Records remain separate between colleagues and devices.

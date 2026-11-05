# Reuse complete teaching units — 0.27.0

Staff choose **Copy unit** from a course unit, select an allocated destination classroom, name the copy and choose the tasks to include. Material, task files, quiz definitions/keys and marking rubrics are copied into independent records. Student selections, deadlines, release dates and prerequisites are cleared for the new class. Student submissions, marks, discussions, help conversations and completion records remain with the original class.

The new unit and copied assessments are private drafts. Draft units are hidden from student unit lists, assignments, learning paths, progress counts, updates and help endpoints. Saving an edited draft preserves that status. **Review & publish** shows the material, dates and selected tasks before making the unit available; unchecked draft tasks stay private. Any tasks already assigned inside a draft unit are explicitly included in that review. New release/prerequisite settings remain effective after publication. Students receive an in-app unit update when the unit becomes available.

Copy requests recheck ownership and the source snapshot inside the transaction. Retrying an identical operation returns the same copy, preventing duplicates after an uncertain response. Publication similarly rejects stale review snapshots. A Refresh review button fetches edited task details before approval. Source-task links open separately so teachers can review without discarding copy choices. Long task lists collapse after six items.

Validation: 295 automated tests and syntax checks pass. Browser QA copied a Year 9 unit and assignment to Year 8, confirmed it stayed hidden from the destination student, edited the copied deadline, refreshed the publication review and published it. The student then received the independent task with the new deadline and an empty submission. Draft assignment saves now refresh their own view immediately, keeping revisions current for further edits.

Existing browser-demo records are retained. Public hosting remains browser-local; copies created by one tester do not sync to another colleague’s browser or device.

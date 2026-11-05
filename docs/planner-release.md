# Weekly learning plan — 0.23.0

**Classroom → Week** brings assignment deadlines, published class events and the MIS timetable together. Teachers can filter by teaching group, check class deadlines before scheduling an event, save event drafts, publish them and cancel or restore them. Event revisions are checked atomically. Class events are separate from graded assignments and do not alter timetable placements or assessment marks.

Students see only their allocated classrooms, currently released work and published events. Assignment audiences, course locks and individual deadline extensions apply. Completed work can be hidden; tasks without a deadline and lists longer than three items use disclosures to minimise scrolling. Time estimates exclude completed tasks and flag tasks without estimates. Weekend items are available separately.

Family accounts have a read-only **Week** view. Each request rechecks the active Directory relationship; teacher drafts, cancelled events, student answers and marking keys are excluded.

**Download calendar** generates a local ICS file for the selected week and classroom filter, containing published events and visible deadlines. It includes correct all-day date boundaries and converts Tashkent event times to UTC. No third-party account or calendar connection is used. Imports are snapshots, not synchronised subscriptions.

Validation: 256 automated tests and syntax checks pass. Browser QA verified event drafting, publishing, class-deadline checks, student visibility, family viewing, cancellation/restoration, and actual ICS download and time values. The same integrated browser-demo database is retained. Public demo records remain local to each browser and do not sync between colleagues or devices.

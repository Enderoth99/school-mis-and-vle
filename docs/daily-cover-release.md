# Daily staff cover — 0.44.0

Admin has a Cover link in the left navigation. Choose a date and add one or more absent staff from the dropdown. Their full timetable for that weekday appears, including registration, class, start/end time and room. Staff with no lessons are identified explicitly.

Each period has a cover dropdown. Choices exclude all absent staff, inactive/disabled accounts, overlapping lessons in the teacher's own timetable, blocked timetable slots and other overlapping cover assignments. Checks use actual start/end times, rather than assuming every period label means the same time. Adjacent lessons may use the same teacher. Both halves of a double lesson are shown separately. Availability is a timetable check, not a subject-qualification recommendation.

When every lesson has valid cover, the email table appears. Save cover plan enables Copy table for email. The clipboard contains formatted HTML table markup and tab-separated plain text. Nothing is emailed automatically. If clipboard access is denied, a manual text fallback is shown. Copy rechecks the saved plan and current timetable before proceeding.

Incomplete plans can be saved as drafts. Dates have independent records, with revisions and a cover audit history in the existing Directory store. A stale save or changed timetable/availability is rejected for review. Absence lists without lessons can also be saved or cleared. Cover does not rewrite the base timetable, attendance, assessment marks or account permissions.

Validation: 372 automated tests and syntax checks pass. Tests cover interval overlap, adjacent periods, blocked time, multiple absent staff, double booking, escaping email HTML, draft/completed saves, stale records/signatures, separate dates, weekends and admin-only HTTP access. Browser QA assigned twelve periods for Noah Morgan and Eva Chapman on 2 November 2026, saved and reloaded the plan, and pasted its plain-text output successfully. A controlled paste test confirmed both text/html and text/plain payloads, with actual table markup in the HTML.

The public Learning Hub remains the free browser-local demo. Saved cover plans do not synchronise between colleagues or devices. It uses the active MIS weekly timetable for the selected weekday; school closures and non-timetabled duties are not inferred.

Published check: the two-teacher, twelve-period plan was saved on the live Learning Hub and copied successfully. The completed email table screenshot is output/daily-cover-live.png.

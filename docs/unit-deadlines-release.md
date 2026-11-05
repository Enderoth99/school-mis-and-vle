# Unit deadline planning — 0.28.0

The private unit publication review now includes a date field for each draft assessment, a single date to apply to all selected drafts, and a clear-selected-dates action. Individual dates can then be adjusted. Unchecked task date fields are disabled and excluded from the request; those tasks remain drafts with their previous dates. Existing assigned tasks retain their deadlines.

Dates and publication save in one transaction after the existing allocation, task membership and snapshot checks. Invalid calendar dates, duplicate entries and dates for unselected, foreign or already assigned tasks reject the entire action. Blank dates explicitly clear a selected draft's deadline. The publication audit includes the applied dates. Legacy publication requests without dates remain compatible. Students, the planner and task lists use the existing assignment deadline field.

Validation: 299 automated tests pass, including four new deadline/publication tests, and syntax checks pass. Browser QA applied a bulk date, unchecked a task and confirmed its date input became disabled, reselected it, cleared the date, set an individual deadline and published. The resulting assignment showed Due 23 Nov with all 18 students still Assigned and no submission content.

The integrated browser-local database namespace and existing records are preserved. This is still a fictional browser-local demo, without cross-device synchronisation.

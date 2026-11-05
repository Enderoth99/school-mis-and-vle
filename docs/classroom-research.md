# WIST Classroom: research and implementation

Research date: 1 November 2026. This is a WIST-branded reconstruction of familiar learning workflows, not an official Google or Microsoft product.

## References reviewed

- [Google for Education: official Classroom walkthrough video](https://www.youtube.com/watch?v=UEFgW--0094). Reviewed in the browser with muted playback and captions; inspected the Stream/banner/navigation and People workflow frames. The official description covers Classwork organisation, grading, comments and rubrics. This is a 2020 tutorial; it is used for established interaction patterns, not as evidence of current feature availability or a claim that every video feature is implemented.
- [Google's illustrated getting-started guide](https://services.google.com/fh/files/misc/getting_started_with_google_classroom_guide.pdf). Reviewed its documented class creation, Stream and assignment workflows and the illustrated Stream/Classwork pages.
- [Google Classroom teacher introduction](https://support.google.com/edu/classroom/answer/9582854) and [Classroom overview](https://support.google.com/edu/classroom/answer/6020279).
- [Google's assignment and attachment workflow](https://support.google.com/edu/classroom/answer/6020260): reviewed the create, turn-in, return and resubmit sequence.
- [Google Classroom API concepts](https://developers.google.com/workspace/classroom/guides/key-concepts/api-structure): reference for separating courses, coursework, resources and submissions. No Google API connection was created.
- [Microsoft: organise a class team](https://support.microsoft.com/en-us/teams/education/quick-start/get-organized-in-your-class-team) and [create assignments](https://support.microsoft.com/en-gb/education/assignments/create-an-assignment-in-microsoft-teams).
- [NSW Department of Education: transcript of its Teams Classwork modules video](https://education.nsw.gov.au/teaching-and-learning/technology-for-learning/resources/professional-learning-resources/microsoft-resources/microsoft-teams/using-teams-in-the-classroom/transcript-setting-up-classwork-modules). Transcript reference, not a claim of watching that video.
- [Microsoft connector retirement notice](https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/), specifically the April 2026 update: the old Office 365 connectors were scheduled for disabling in May 2026. A future live integration should use supported Microsoft Graph/Workflows and an authorised school tenant, not old connector webhooks.

## Design decisions

Keep MIS as the source of identity, teaching allocation and enrolment. Automatically create learning spaces from existing courses; exclude registration and assembly. Students use their existing six-digit number and land in Classroom. Teachers retain their MIS start page and receive a Classroom navigation link. Administrators additionally receive Student passwords.

Use a compact card overview and Stream, Classwork, People, Grades/My grades and Apps & resources tabs. Coursework has topics, titles, instructions, maximum marks, due dates, draft/publish controls, HTTPS resource links and files. A starter assignment is available in each classroom without writing duplicate MIS grades. Private submissions support saved drafts, turn-in, withdrawal, returned feedback and resubmission. Returning a mark saves it in Classroom and releases feedback to the student. Teachers separately preview and select returned scores with Add scores to MIS. One stable MIS assessment per assignment is updated only after that explicit action; stale MIS or submission revisions are rejected, other students’ marks are preserved, and repeat transfers create no duplicate assessments. Existing tracking and report calculations read that assessment store. Grade and report page caches are invalidated after a transfer.

Borrow Teams' class-resource organisation through named Google Drive, Microsoft 365, Forms, OneNote, YouTube and custom HTTPS links. These are functioning resource links, not OAuth connections, account synchronisation or document-copy automation. No external announcements or webhooks are sent.

Student password overrides use random salts and PBKDF2-SHA256, with 120,000 iterations. Numeric identity stays unchanged. Admin-only resets increment the student's session version and preserve an audit event; previous passwords and sessions stop working. No plaintext overrides or hashes are returned to the UI. The default fictional password remains public for demonstration.

## Testing and deployment boundaries

The Learning Hub remains the user-selected free, browser-local demo: records and password resets persist in that browser's IndexedDB and are not shared across devices. Test teacher/student workflows by signing out and switching accounts in the same browser. Existing browser records and database identifiers are preserved. The Node backend also implements these routes with persistent files and optional existing cloud persistence, but no paid backend or school OAuth tenant was provisioned.

The browser demo contains fictional data and publicly downloadable fixture bundles. Its account picker is a demonstration of role workflows, not a production security boundary. Real pupils require a shared authenticated backend, rate limits, school identity policies, managed storage, backup/retention controls and authorised integrations before use.

Files are downloaded as attachments, not rendered as executable HTML. Supported types are PDF, TXT, CSV, PNG/JPEG and DOCX/XLSX/PPTX; up to three files, 1 MB each. Linked provider documents retain their own sharing permissions.

Deferred features include live Google/Microsoft account connections, document co-editing and per-student Drive copies, video meetings, notifications to external recipients, rubrics, scheduling, guardian accounts, and a production multi-device service. These are not presented as working connections.

## Forms-style quizzes and optional MIS transfer

Teachers can create, save and edit draft quizzes, then publish to the course roster. Question types: multiple choice, checkboxes (all correct options must match), true/false, short answer and written response. Each question has points and a required flag; total marks are derived from the questions. Short answers can use an optional list of accepted exact answers; comparison ignores case and repeated whitespace. Otherwise short and long written answers need teacher marking. Teachers can add/remove/reorder up to 40 questions and add/remove up to eight choice options. Published keys are immutable; create another quiz to change them.

Students can save partial answers, turn in, unsubmit and resubmit. Automatic marks are computed in the store from the saved answer key; supplied student scores are ignored. Student API responses omit answer keys and provisional marks. Teachers review/override per-question awards and return the result. Returned Classroom results appear in the student progress view even before a MIS transfer. Once transferred, that assessment is not duplicated in progress. Existing MIS data and browser database identifiers remain unchanged.

This is the same fictional browser-local demo boundary described above. The backend routes enforce course membership and role access, but the static browser demo is not a production exam-security environment.

## Expanded question library

See [question-library-coverage.md](question-library-coverage.md) for the 26-type Google/Microsoft Forms question-family comparison, image/formula support, interactive controls, tests and product boundaries. Teacher-selected MIS transfer remains unchanged.

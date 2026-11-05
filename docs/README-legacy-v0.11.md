# WIST teacher workspace prototype v0.11

A local MIS test environment with 1,000 fictional students, 60 fictional teacher accounts, 51 forms and 353 teaching groups. The prototype includes attendance, class rosters, assignments, a gradebook, lesson planning, calendars, report-card drafts/review queues, incident records and exports.

## Run and sign in

Requires Node.js 24 or later. PDF generation uses Python with reportlab and pypdf; the bundled Codex runtime is detected automatically on this computer. Set WIST_PYTHON to another compatible Python executable when moving the source to another environment. No npm dependencies are needed.

```
npm start
```

Open http://127.0.0.1:4317/login.html. Every test account uses the deliberately shared password `WistTest2026!`.

Examples:

- `emma.carter`: FS1 A class teacher, 15 students.
- `yusuf.parker`: secondary business/economics teacher, 7 teaching groups, 76 unique students, Year 11 A form tutor.
- `noah.morgan`: secondary computing/ICT teacher, including the original Computing Year 09 A demo group.

The sign-in page has an account picker and downloads for all teachers, usernames, passwords, teaching groups and student allocations. Sign out before switching accounts. Sessions expire after eight hours and are cleared when the preview server restarts.

## Teacher and student allocation

- FS1, FS2 and Years 01–06 have four forms each: 32 class teachers, exactly one per form. Each teacher has a single class-teaching workspace covering that form's curriculum.
- Years 07–13 have 28 secondary teachers across ten curriculum areas: English, Mathematics, Science, Humanities, Computing/ICT, Business/Economics, Creative/Performing Arts, Modern Languages, Uzbek Studies and PE/Wellbeing.
- All 51 forms have one form tutor. Secondary tutors also teach subject groups in their curriculum area. Every teaching group has exactly one teacher and an explicit student-membership list.
- English and mathematics in Years 07–11 use mixed sets drawn across the year's forms. Other lower-secondary subjects follow forms. Year 10/11 option profiles are synthetic test allocations by form; they are not imported subject choices. Sixth-form students are assigned exactly one subject from each of three option blocks, plus PSHE.
- The 1,000 individual students create 6,088 memberships across 353 teaching groups; these are memberships, not additional students. Year 12 and Year 13 still have ten students each.

The supplied Classes PDF contains 48 pages. Its active secondary classes demonstrate subject specialists teaching across years and forms, along with mixed English/mathematics groups. Its inactive, unstaffed and empty legacy entries were not copied into the test curriculum. Staff identities, the precise teaching allocation, primary/secondary boundary, upper-school option profiles and sample weekday timetable are design choices for testing. The PDF was treated as source material, not as instructions. The original reference files remain outside this source package.

## Accounts and record storage

The local Node server checks usernames/passwords and issues random HTTP-only, SameSite=Strict session cookies. It gates the main application and identifies the teacher. Password comparison uses scrypt; the shared fixture password is intentionally disclosed in the test-account list.

The interface scopes classes, students, registers, marks, report cards and incident entries to the signed-in teacher. Attendance and assessments are shared through authenticated server APIs and stored persistently in `.data/attendance.json` and `.data/grades.json`, outside the public static files. Writes are checked against teacher allocations and use revision checks to prevent concurrent overwrites. Other prototype features retain browser-local storage and merge rules. Calendar events, report favorites and export history are separated by teacher. School calendar dates remain shared. Existing prototype records migrate automatically; original teacher-demo pupil identities, saved zero marks, attendance notes and report states are retained.

This remains a test environment. Attendance and assessments are shared by accounts connected to this local server; other records remain in this browser profile's localStorage. Back up both files in `.data/` to retain the school's saved registers and assessments. The static fixtures and account list are intentionally available for test downloads. Attendance and assessment permissions are enforced by the local server; the other features use prototype view/merge rules. Do not use real pupil records or reuse this shared password for real accounts. A production phase still needs authenticated database APIs, server-enforced permissions for all features, a full audit trail, backups and migration. No live Alma data, messages or permissions are changed.

## Fixture exports

```
npm run fixtures
```

This regenerates:

- `dist/data/teacher-accounts.csv`: all 60 names, logins, shared test passwords, areas and allocation counts.
- `dist/data/teaching-groups.csv`: 353 teaching groups, teacher owners and student counts.
- `dist/data/student-group-memberships.csv`: 6,088 explicit student-to-group memberships.
- `dist/data/teaching-allocation.json`: machine-readable teachers, form tutors, teaching groups and memberships.
- `dist/data/students.csv` and `students.json`: the same 1,000 synthetic students, with stable numeric student IDs, unique TEST admission numbers, age-aligned fictional dates of birth and non-deliverable test emails.
- `dist/data/form-sizes.csv` and `population-summary.json`: all 51 form sizes and year totals.

## Verification

```
npm run check
npm test
```

There are 66 automated checks, including successful login/session identity for all 60 teachers, invalid login/logout, primary and curriculum-area allocations, full membership coverage, mixed-set uniqueness, sixth-form options, preservation of legacy test data, and rejection of writes to another teacher's groups. Browser checks cover primary/secondary sign-in, scoped views, attendance saving, secondary assignment creation, account switching and preservation of each account's saved work. See `qa/teacher-verification.json`.

The timetable is a sample weekday display per teacher, not a conflict-free whole-school timetable. Live external email and parent/student accounts remain outside this prototype. Local class messages, drafts, announcements, report review/issue and genuine PDF downloads are available for testing.

## WIST branding

The sign-in page, workspace header and sidebar use the original WIST logo artwork from https://wistedu.com/. Narrow navigation, the favicon and printable report headers use the original compact W icon. Source URLs are recorded in `dist/assets/SOURCE.md`. Assets are served locally with their original proportions and colours. Desktop and narrow layouts were visually checked after the update.



## Compact lesson registers

Attendance uses a fixed-height workspace with a scrolling student list and sticky table headings. Class, date, period, bulk-present and Save controls stay visible. Arrival time appears beside a late status; notes open in a small dialog and remain part of the unsaved register until Save attendance is selected. The register was checked in the narrow app panel with no horizontal table overflow, and the original saved attendance note remained accessible.



### Late arrival clock

Selecting Late (Excused) or Late (Unexcused) opens an arrival-time popup automatically. The chosen HH:mm time appears in a dedicated Arrival time column beside the attendance status. Teachers can reopen it with the clock button or choose Use current time. Applying a time updates the draft; Save attendance persists the register. Other statuses hide the clock and clear any old arrival time. Both late codes were checked in the browser, including retaining an existing 11:12 arrival time, without saving over the original open register edits.


## Shared daily attendance and lesson handover

Each student has one stable numeric ID. IDs are included in reporting and fixture exports but are hidden in the lesson register. Every saved register is retained separately by date, teaching group and period. All students need an attendance status before saving; incomplete legacy registers are retained for correction.

Opening an unsaved lesson prefills each student from their latest saved earlier period on the same day, including records from another teacher and mixed teaching sets. A saved register for the selected lesson takes priority. Earlier late arrivals become Present if the arrival time is before the next lesson starts; original lateness and notes remain in that earlier lesson's history. Lesson notes are not copied into a new lesson. Review the prefilled attendance and Save to create that lesson's record.

Reporting → Daily student attendance history exports all saved lessons for the selected class's pupils across teachers, with student ID, date, period, status, arrival time and original note. Class register and lateness exports also read shared storage.

The narrower Arrival time column keeps its clock control. Back appears between Cancel changes and Save attendance and returns to the previous application screen, with Keep editing, Discard and Back, or Save and Back when changes are unsaved. Saved browser registers migrate into shared storage on sign-in without overwriting newer shared saves. Server storage uses atomic file replacement and survives server restarts; sessions require signing in again after restart.

### Minute adjustment controls

The arrival-time popup has visible up/down arrows that add or subtract exactly one minute, including moving between hours and wrapping at midnight. Adjustments stay in the popup until Apply time, then remain in the unsaved register until Save attendance. Browser verification checked 11:12 → 11:13 → 11:12 without changing saved attendance. The Computing Year 09 A Gradebook preview shows assignment selection, marks out of the assignment maximum, calculated percentages, ungraded blanks, Cancel changes and Save marks.

## Assessment gradebook and student insights

Open My classes → a class → Gradebook. New assessment starts a named, dated assessment with a maximum mark. Type marks in roster order; percentages appear immediately to the right. Save assessment writes a single revision-checked record to shared storage. Blank is ungraded and zero counts as a mark. Decimal marks/maxima are supported. Updating an assessment replaces that assessment's revision; creating another keeps all previous assessments.

Class tracking sheet shows all pupils against all saved assessments. All my students shows every pupil allocated to the signed-in teacher and their subject means using saved marks from all their teachers. Both trackers offer CSV exports with hidden numeric pupil IDs. Existing browser assignments/grades migrate once on sign-in, preserving zero. Shared saves are never overwritten by subsequent legacy imports. Reporting's mark export and Export backup read the shared assessment store.

A pupil's Daily overview presents supplied daily information, shared lesson attendance and that teacher's existing browser-local behaviour records. Grades opens an interactive dashboard with subject/date filters, average and comparison cards, per-subject comparison bars, a chronological assessment chart, and detailed results. Refresh reloads other teachers' recent saves. All subjects in the pupil's current enrollment appear, with no fabricated grade where no mark exists. This is a local analytics interface, without a Microsoft Power BI dependency. Behaviour records and other prototype features have not yet been moved into shared server storage.

Averages are equal means of saved assessment percentages, excluding ungraded entries and including zero. Student-versus-class comparisons use the same marked assessments, and each assessment's own class/set average; class averages include only pupils with entered marks. Difference is in percentage points, not percentage change. Every grade remains joined to the same stable pupil ID used by attendance. A teacher can edit only their own classes and view cross-subject results only for their allocated pupils. Comparison data contains group averages, not individual classmates' marks.

Browser checks: created a demo Computing assessment (20/25 → 80%, 0/25 → 0%), saved it, verified the class tracker and all-student tracker, opened the pupil daily overview, then saved a Science assessment as a different teacher. The Computing teacher's pupil dashboard correctly showed Science 34/40 = 85% against an 80% class average (+5 pp). Original unsaved attendance tabs were preserved.

### Compact headings and assessment links

The Gradebook combines its class name, teacher, pupil count and room on a single line. Student Grades combines the pupil name, form, active view and navigation on one line and removes the repeated insights title. Dashboard subject names link to that subject’s latest saved assessment in the selected date range. Assessment-detail subjects and titles link to the exact saved assessment. The read-only detail page shows marks, percentages, class average and percentage-point difference. The responsible teacher can use Open gradebook to edit that exact assessment; other teachers see only pupils allocated to them, while the comparison continues to use the full class average.

### Subject-specific assessment trends

The student assessment trend now draws one independent coloured line per subject. The horizontal axis is assessment order within each subject (oldest first), so Art assessment 1 connects to Art assessment 2, and never to a different subject. All marked subjects appear by default; click a subject chip to isolate it and show its matching dashed class-average trend, or All subjects to restore the full chart. The dashboard subject/date filters still apply. Ungraded assessments keep their place without inventing a zero; a subject with one mark shows one point. Chart points link to their exact saved assessments.

## Secondary assessment demo population

Years 07–13 now have five additional labelled demo assessments per subject teaching group: 324 pupils, 283 groups, 1,415 assessments and 23,820 individual marks. Dates are 4 September, 18 September, 2 October, 16 October and 30 October 2026; maxima are 20, 25, 40, 50 and 100. Student/subject-specific variation creates different progress trajectories and class averages. Existing assessments remain, so some subjects have more than five total results. Primary, homeroom and assembly groups are untouched.

To reproduce the population, stop the preview server, run `npm run seed:secondary-grades`, then `npm start`. The seed writes the private shared grade store atomically, uses deterministic IDs and skips existing demo records, including teacher-edited demo marks. Do not run the file seeder while the server is running, because the server holds its active grade state in memory. A pre-seed backup is retained at `.data/grades-before-secondary-demo-20261030.json` in the current workspace.

### Missed-assessment sample

Exactly 1,191 of the 23,820 generated secondary results (5%) are marked Missed, leaving 22,629 entered marks. This changes individual student/assessment outcomes, not entire subjects. Existing teacher-created assessments and teacher-edited demo assessments are preserved. Missed is stored separately from numeric zero and ordinary ungraded blanks. Class tracking cells, mark entry and assessment details label it explicitly; student dashboard cards count misses; CSV exports retain the status. Student means, class means and trend scores exclude missed results. Assessment order still retains their place. Entering a later numeric mark clears that pupil’s missed status for the assessment.

To reproduce, stop the server, run `npm run seed:secondary-grades`, then `npm run seed:missed-grades`, and start the server. The missed sample is deterministic and applied once, so re-running it preserves subsequent teacher changes. The original completed data is backed up at `.data/grades-before-missed-demo-20261030.json` in this workspace.

## Homepage attendance links and class messaging

Overview now reads authenticated shared day-attendance contexts for the signed-in teacher’s sample timetable. Absent, Late and Left early counts are clickable and list the pupils by stable ID, with links to each pupil profile and the lesson register. Taken registers show their saved marks; untaken lessons may carry earlier saved same-day attendance and are explicitly labelled as earlier attendance requiring confirmation. Empty registers stay Not taken. The student Grades dashboard still uses the original grade tracking IDs and subject-specific lines; the checked pupil retained 17 subject series, 86 scored points and 3 missed outcomes.

Message My Classes is available on Overview, with an envelope shortcut beside each timetable class. The compact composer supports all/selected classes, student/teacher recipient choices, a copy to the sender, optional class announcement posting and pinning, subject, text formatting, safe links, preview, draft saving and up to three attachments (5 MB each, 10 MB total). Students in multiple selected classes and duplicate teacher copies are deduplicated. Parent contacts and TAs are not configured; parent selection is disabled.

Delivery is local test delivery only. Send test message persists a sent record and posts any selected class announcements; it never invokes email or an external provider. Messages lists saved drafts and sent local messages. Sent records are read-only, and pinned announcements appear first on the class Dashboard. Messages and attachment bytes are stored privately in `.data/messages.json`; session and class permissions protect their APIs and attachment downloads. Include this third file when backing up the full `.data` folder. Export backup includes owned message metadata; the private JSON file is needed to retain attachment bytes. Runtime data remains outside the source archive.

Browser verification saved a one-class draft with bold text and a fictional text attachment, sent it locally, verified the pinned class announcement and downloaded the exact attachment. Cancel/Keep editing/Discard retained then removed an unsaved test composition. Original open register and report-card drafts were left in place. Homepage tests distinguish earlier carry-forward from a saved register and link pupils back to the same student tracking page.

## Whole-student reporting and branded PDFs

Report cards now uses authenticated shared records in `.data/report-cards.json`. Teachers enter attainment, effort (E/VG/G/S/ND/NA), and optional subject comments in compact class sheets. Primary teachers can select curriculum areas within their class. Assessment means use the same student IDs and saved marks as the tracking dashboard, but do not automatically assign report grades or invent grade boundaries. Draft saving and submission are revision checked; pending and approved rows are locked until a reviewer returns them with a reason. Existing browser report comments, grades and workflow states migrate without replacing newer shared edits.

Whole-student reports combine actual subject/set enrollments, subject teacher names, form-tutor homeroom comments and saved attendance. Only the allocated form tutor can write the homeroom comment. Attendance counts recorded dates with an absent lesson mark, once per date, rather than claiming these are full-day absences; an unrecorded period is shown as Not recorded. Missed assessments are unrelated to attendance and are never counted as absence.

A separate fictional `report.reviewer` login uses the existing shared test password. Choose Report Reviewer in the sign-in account picker. This role can read student tracking and review/return subject and homeroom reports, but cannot impersonate a subject teacher or change assessment marks. All sections must be submitted and approved before whole-student issue. Approval/issue checks the version actually opened by the reviewer; issue snapshots and workflow events are retained. Returning a row does not modify an earlier issued snapshot. Issued versions can be selected for PDF download; repeating issue without changes does not create duplicate versions.

The downloaded PDF uses a white-background WIST wordmark, school details, blue pupil banner, repeating headers, homeroom comments, attendance, effort/attainment tables, the supplied grading key and an unsigned sign-off section. It uses Letter size to match the reference and paginates long comments and class tables. A class draft-PDF pack is available as well as single-pupil draft and issued PDFs. Draft PDFs are visibly marked not issued. School sign-off roles vary by phase. No real pupil photo or headteacher signature has been copied into the template.

The completed fictional Alex Ellis sample is in the separate Demo completed report cycle, leaving the normal October cycle and the original open draft intact. To recreate it, stop the server, run `npm run seed:report-demo`, then restart. The demo seed never replaces existing report work. The three-page sample is in `output/pdf/wist-report-alex-ellis.pdf`; its PDF generation and all rendered pages were checked. The normal cycle and template settings are in `dist/report-config.mjs`.

PDF rendering runs locally through `scripts/render-report.py` with ReportLab and pypdf. The Node server sends validated report snapshots through stdin, receives real PDF bytes, and does not invoke a remote document service. Back up `.data/report-cards.json` alongside attendance, grade and message files. Export backup includes shared report data within the account’s permissions. The supplied reference PDF and its real pupil/signature images are not included in the source archive; only the school logo asset is reused.

## Working school Directory

The authenticated Directory contains 1,000 existing students, 60 teachers plus the report reviewer, 1,600 fictional guardians across 800 households, and 40 inactive examples. All student IDs and existing teaching memberships are retained. Search names, school/numeric IDs, visible test email or phone; combine people type, year, surname initial and inactive filters. Results paginate with fixed controls and an internally scrolling card list. Export page exports only the visible result page.

Click a name for Bio, Schedule and Contacts. Student profiles link to the same daily overview, grade trends and reports; parent profiles link back to children. Teacher schedules use existing allocations; student schedules are an explicitly labelled demonstration rotation, not a conflict-free whole-school timetable. Class links open the correct read-only roster, with an edit-workspace link only for the allocated teacher.

Directory details persist privately in .data/directory.json. Back up this file with the other shared stores; browser Export backup does not include Directory contacts or photos. Private DOB, addresses, phones, emergency and medical details are limited to allocated pupils/families, the staff member themselves, and the test reviewer. Search and exports apply the same access restrictions. All supplemental contacts/health/address records are fictional; emails use .invalid, phones have a TEST marker and invalid 00 network prefix. No real profile photos are copied. Photo upload is limited to the staff member themselves and the reviewer, with validation and revision checks. Parent/student portal logins are not enabled.

Validation: npm run check and all 73 tests pass, including seven Directory tests covering stable identities, family links, search, privacy, navigation, schedules, photo persistence/concurrency and authenticated endpoints. Existing report tests verify teacher-entered grades remain separate from assessment means.

## Attendance overview tabs

Attendance without a class parameter now opens View all, School attendance and Class attendance. A class parameter continues to open the existing lesson register, including late-arrival clocks, save validation and shared tracking. View all shows saved period marks alongside registration, with student search, year/status and absence/presence discrepancy filters. Late registration followed by Present is not a discrepancy. School attendance uses the latest saved R mark for each pupil; missing registration stays Not Taken even when a later class mark exists. Summary counts cover the permitted population and remain visible while filtering. No new attendance data is invented.

Class attendance shows sample weekday timetable slots plus additional saved class/period combinations. Completion and absent/late/present/left-early/not-taken counts use saved marks only; prefilled but unsaved marks do not count as completed. Incomplete imported registers are shown explicitly; normal lesson saving still requires every pupil to be marked. Weekend sample schedules are empty, with saved exceptions retained.

Teachers see their allocated pupils and class rows; saved marks from other teachers for those same pupils remain visible without granting register write access. The report reviewer has whole-school read access and an Attendance navigation item. Student links open Directory profiles; owned class/period links open the corresponding register, and Back returns to the filtered overview. Foreign class links open the read-only Directory roster. Date arrows, search, filters, Refresh and filtered CSV exports are available on all three tabs. Save invalidates the local overview cache; use Refresh for marks saved in another tab. Tables scroll inside the viewport with sticky headings and fixed controls.

Validation: all 80 tests pass, including seven attendance-overview cases for allocation, registration semantics, discrepancies, incomplete registers, weekend exceptions, cross-teacher evidence and authenticated reviewer access. Browser checks cover all three tabs, completion filtering, opening the saved Computing Year 09 A register (13 present, 1 late at 11:12), Back to the filtered tab, date navigation and CSV download.

## Shared cloud colleague-test preparation

Version 0.10 adds Cloud Run/Docker packaging and private, generation-checked Cloud Storage persistence for all five shared JSON stores. Hosted writes validate an explicit HTTPS origin; session cookies use Secure. Workload identity supplies storage access without embedding service-account keys. The data remains fictional and class messaging still sends no external emails. Six cloud-specific tests plus the existing suite pass (86 total), including full server restart persistence, stale revision rejection and storage-failure rollback. Source seed files are ignored by Git and intentionally included only in the deployment context.

Deployment is prepared in deploy/provision.ps1 and deploy/README.md. The existing Learning Hub at https://enderoth-learning-hub.web.app/ is in the Firebase project economics-monopoly (339810644396). The deployment command checks billing first and stops if it is disabled. The user's own billing-account selection is required; no account is chosen automatically. At the last check Google still reported billingAccountName empty and billingEnabled false, so no Cloud Run service, storage bucket or public landing card has been published. The local landing catalogue, translations and index were verified to match the live files. deploy/prepare-landing.mjs prepares the backed-up catalogue change only after a verified MIS URL is supplied.

## Free public colleague demo

The user chose the browser-only demo instead of enabling billing. It is published at https://enderoth-learning-hub.web.app/wist-mis/ and linked from the Learning Hub. See demo/README.md for limitations, build details and verification. No Cloud Run service or private storage bucket was provisioned; cloud deployment files are retained as future preparation.

## Timetabling second tier — 31 October 2026

The ACTS-inspired planning workspace is available at #/timetable and the separate public preview https://enderoth-learning-hub.web.app/wist-timetabling/. The existing colleague demo at /wist-mis/ and its landing entry are unchanged. The preview uses an isolated database and MIS preference key. Planning drafts are browser-local, separate from all existing attendance/grades and not automatically applied to registers.

Data input, editable teaching loads, section/teacher/room boards, teacher/room/section time-off matrices, room capacities, manual placement/dragging, locks, bounded background generation, cancellation, undo/redo, JSON backup/import, CSV and browser printing are implemented. Focus board hides auxiliary controls to fit more of the week. Parallel mixed sets are individually inspectable without displaying them as a conflict. All linked IDs remain canonical; weekly curriculum targets are illustrative. Start with Year 09, then choose Secondary or Whole school.

The independent engine enforces actual student overlaps, teacher/room overlaps, capacities, eligible rooms, unavailable slots, consecutive periods across breaks, lesson spreading and maximum daily teacher load. A bounded solver can leave cards unassigned; this is visible and never reported as complete. Year 09:120/120 placed; secondary:544/544 placed in a measured browser worker run. Whole-school benchmark:1500/1504 within budget, four unassigned. No external AI or paid API is used and ACTS's proprietary solver was not recovered.

All 106 tests pass (20 new timetable tests). Browser checks include room blocking, invalid moves, locks/clear/undo, load edits, persistence and backup. See docs/timetabling-evidence.md for the sampled six-video REA research, exact evidence IDs, observations, limitations and non-implemented ACTS features.

The demo builder supports an optional base path and entry route: node demo/build.mjs EMPTY_OUTPUT_DIRECTORY /wist-timetabling/ /timetable. The output directory must be empty. The isolated preview seeds a solved pilot only for visitors with no saved draft. Do not rebuild or replace /wist-mis/ while a colleague is testing that release without an explicit coordinated update.

### Rules v2 correction (31 October 2026)
Earlier 30-period solver measurements above are historical and no longer establish completion. The 40-period school rules, PE doubles, pupil coverage and parallel Year 10–11 blocks are now checked; only Years 12/13 permit frees. All 123 tests pass. Current dummy staffing can leave compulsory gaps, which are explicitly marked Missing. Existing drafts can be upgraded with Apply school rules, keeping a browser backup. New preview visitors receive an honest partial draft. Actual option-block lists remain pending. See docs/timetabling-evidence.md for current measurements.

### 2025–26 document options (rules v3)
The supplied Timetable options 2025_26.docx now defines selectable Models 1–4 for Years 10/11. Each block A–I has four lessons (36 total), plus PE double, assembly and PSHE (40). Model 1 is the default; Option blocks → Choose models selects each year independently. Mandatory science and marked eligibility are checked; test choices/eligibility remain fictional. Sixth-form subjects also have four lessons. Existing v2 drafts offer a backed-up upgrade. All 128 tests pass; timetable incompleteness remains explicit, and the colleague MIS release remains separate.

The public timetabler is now one Model 1 demonstration for preparation of 2026–27 option changes. Model selection is removed. The 2025–26 document remains the source reference; it is not presented as a finalized 2026–27 timetable. Saved compatible Model 1 plans keep their placements.

The plotting board now offers Load scheduled demo (with a backup) and Find slots for selected cards. The scheduled secondary example has 702/769 cards placed with no hard clashes, but is incomplete: 67 cards remain unassigned. Valid moves respect PE doubles and parallel options; diagnostics explain blocked times. New visitors receive the secondary snapshot; existing drafts are preserved. Rebuild it with npm run demo:timetable before packaging the preview. The generator retains a better existing valid partial draft when a shorter search cannot improve it.

### Manager journey
The manager now starts with School week → People & rooms → Student options → Teaching loads → Constraints → Validate inputs → Generate & refine. The load workbench follows the observed ACTS layout: teacher capacity, distribution checklist and previewable Quick Assign. Add/edit planning staff and subjects, update test option choices and room/time-off data, then review inputs before generation. Reviewed stages reopen when relevant data changes. New teachers are planning-only and do not create MIS accounts. Actual membership/load edits safely unassign affected unlocked block cards. All 154 tests pass. See docs/acts-manager-workflow.md for the retained evidence and parity boundaries.

### Full timetable integrated MIS test

The separate `/wist-mis-testing/` release activates a complete 2,017-card timetable for all 1,000 pupils, with date-specific teacher and pupil schedules, exact course rosters, registers and grade/report references. It adds three fictional teachers and two fictional sports spaces to make the test allocation feasible. All 158 tests pass. Existing colleague MIS and planner releases are preserved. See [integrated timetable testing](docs/integrated-timetable-testing.md) for resource assumptions, reproducible build steps and browser-local storage boundaries.

Revision 2 expands the demo to 80 teachers, including 17 primary specialists, with usual classrooms, explicit core/specialist primary lessons and group names from the current Classes.pdf homerooms. The four-group structure and all pupil IDs are retained; the extra Reception group is labelled Robins (demo). Updated student, staff and allocation downloads use the same active data. The separate colleague MIS remains unchanged.

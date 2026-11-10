# School MIS and VLE

A school management information system and virtual learning environment with fictional data for testing. The integrated demo includes attendance, gradebooks, reporting, a directory, behaviour incidents, messaging, cover, technical support, timetabling and Classroom. The timetable fixtures contain 1,000 students in 51 form groups and 80 teachers.

Daily absence totals clear when any saved lesson confirms attendance, including a late arrival. Registration and individual lesson absences remain in the audit history. The attendance overview refreshes every 30 seconds; absence reports and family summaries use the same daily rule.

Try the [hosted demo](https://enderoth-learning-hub.web.app/wist-mis-testing/login.html).

| Role | Username | Demo password |
| --- | --- | --- |
| Administrator | `admin` | `WistTest2026!` |
| Teacher | `noah.morgan` | `WistTest2026!` |
| Year 10 student | `100895` | `WistLearn2026!` |
| Parent | `301273` | `WistFamily2026!` |
| Technician | `sam.turner` | `WistTest2026!` |

Demo accounts and records are fictional. The Learning Hub now uses the full shared backend for attendance, assessments, Classroom, incidents, accounts and school records across computers. Administrators can publish a completed shared timetable draft to teacher and student schedules; draft edits stay separate until publication. See [shared timetable planning](docs/shared-timetable-planning.md). The default portable demo remains browser-local. The earlier Firestore-only incident deployment is now read-only.

## Run from a fresh clone

Install Node.js 24 or newer. To build and serve the integrated browser demo:

```sh
npm ci
npm run build:demo
npm run preview:demo
```

Open [the local demo](http://127.0.0.1:8791/school-mis-and-vle/login.html). The build writes to `build/school-mis-and-vle/`. For subsequent builds, use a fresh empty output directory with `node demo/build.mjs <directory> /school-mis-and-vle/ /admin integrated`.

Run `npm start` for the Node server at [localhost:4317](http://127.0.0.1:4317/login.html). The server starts with the base fictional roster and writes records to `.data/`. For PDF reports and the complete test suite, install Python with `python -m pip install -r requirements.txt` and set `WIST_PYTHON` to its executable if it is not on PATH.

```sh
npm run check
npm test
```

## Incidents and rewards

Staff choose Primary/Secondary, year, tutor group and student, then C1–C3 or R1–R3, incident details and any involved students. Each submission saves an Excel-compatible CSV spreadsheet representation alongside the durable ledger. Download spreadsheet exports the records visible to the signed-in staff member. Existing tutors receive relevant entries on Overview. Admins configure Heads of Year and tutor overrides under Incidents → Tutors & Heads of Year. Historical local incidents migrate on staff sign-in.

## Explore the workflows

- [Year 10 options, staffing rules and Year 11 continuation](docs/year10-model3-release.md)
- [Integrated timetable](docs/integrated-timetable-testing.md)
- [Classroom and learning workflow](docs/learning-workflow-release.md)
- [Administration](docs/admin-research.md), [daily cover](docs/daily-cover-release.md) and [technical support](docs/technical-support-release.md)

The demo uses known test passwords. It is intended for evaluation with fictional records. Production use with real records requires a separate deployment, authentication and data protection review.

Shared incident deployment: see [the deployment guide](docs/shared-incidents.md). Teacher Overview and the sidebar include an Assessment shortcut to the existing per-class mark entry and tracking sheets.

## Full shared backend preparation

The shared server is deployed on the Learning Hub with centrally stored attendance, assessments, Classroom and teacher workspaces, plus persistent login sessions. Static client bundles run on Firebase Hosting; authenticated API requests run on Cloud Run with private storage. See [full shared deployment and migration](docs/full-shared-deployment.md).

Timetable planning drafts now use shared autosave with revision checks, last-editor information and explicit import/recovery of earlier browser drafts. See [shared timetable planning](docs/shared-timetable-planning.md).

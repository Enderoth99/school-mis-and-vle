# School MIS and VLE

A school management information system and virtual learning environment with fictional data for testing. The integrated demo includes attendance, gradebooks, reporting, a directory, behaviour incidents, messaging, cover, technical support, timetabling and Classroom. The timetable fixtures contain 1,000 students in 51 form groups and 80 teachers.

Try the [hosted demo](https://enderoth-learning-hub.web.app/wist-mis-testing/login.html).

| Role | Username | Demo password |
| --- | --- | --- |
| Administrator | `admin` | `WistTest2026!` |
| Teacher | `noah.morgan` | `WistTest2026!` |
| Year 10 student | `100895` | `WistLearn2026!` |
| Parent | `301273` | `WistFamily2026!` |
| Technician | `sam.turner` | `WistTest2026!` |

Demo accounts and records are fictional. Use the same browser when switching roles to test shared workflows in the hosted demo: changes are stored locally in that browser.

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

## Explore the workflows

- [Year 10 options, staffing rules and Year 11 continuation](docs/year10-model3-release.md)
- [Integrated timetable](docs/integrated-timetable-testing.md)
- [Classroom and learning workflow](docs/learning-workflow-release.md)
- [Administration](docs/admin-research.md), [daily cover](docs/daily-cover-release.md) and [technical support](docs/technical-support-release.md)

The demo uses known test passwords. It is intended for evaluation with fictional records. Production use with real records requires a separate deployment, authentication and data protection review.

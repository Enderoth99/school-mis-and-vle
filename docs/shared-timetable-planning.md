# Shared timetable planning

Deployed on the Learning Hub on 10 November 2026. School staff using Timetabling share the school's current planning draft across computers. The initial shared draft is the current integrated school timetable; earlier device-local drafts are preserved for explicit import.

## Staff workflow

- Refresh the MIS and open **Timetabling**. The compact status bar shows the confirmed shared revision, last editor and Tashkent save time.
- Planning edits, generated placements, reviews, undo/redo, backup imports and option-choice imports all use the shared autosave queue. **Save draft** also confirms a save explicitly.
- **Reload shared** fetches the latest draft. The page checks for newer revisions while open and when focus returns. It never replaces a working draft silently.
- If another computer saved first, the save is rejected and local changes are retained. Use **Backup JSON** if needed, reload the newer shared draft and review it before using **Recover local changes** to replace it deliberately.
- To bring over an earlier browser-only plan, use **Import browser draft** on the computer containing it. The confirmation shows the incoming plan and current revision. The original browser data remains intact.

Shared planning uses whole-draft revisions. Concurrent edits are not merged field by field. The separate active MIS timetable and student records are not published or changed by a draft save.

## Persistence and access

`PlanningStore` writes `timetable-planning.json` to the existing private shared bucket. Each save checks the current revision inside a generation-checked transaction. Confirmed revisions and the latest 30 edit summaries survive restarts; Cloud Storage object versioning retains recovery versions. Only school staff can read or write planning drafts. Student, parent, technician and unsigned sessions are denied.

`GET /api/planning/draft` returns the project and revision. `?meta=1` returns metadata only. `PUT` requires the project, expected revision and a retry-safe operation identifier. Invalid resource IDs, malformed projects, changed years of linked MIS forms and oversized payloads are rejected. UTF-8 requests are decoded after assembling their chunks so Russian and Uzbek text is preserved.

The browser serializes saves and queues the newest edit while a request is in flight. If a response is lost after commit, retry uses the same operation identifier before sending later changes. A conflict stops the queue until the user reloads and reviews the latest shared state. Unconfirmed work is retained in memory and a separate local recovery key; the earlier browser draft key is not overwritten when loading shared data.

## Verification

Tests cover independent server/store instances, restart persistence, stale revisions, duplicate requests, failed storage writes, role restrictions, rapid autosaves, uncertain-response retries, metadata races and UTF-8 chunk boundaries. The live Learning Hub check saved through one staff account, read through another, rejected a stale write, denied student/unsigned access, retried without duplicating a revision, and restored the starting plan. A browser save then confirmed the shared revision and editor. The full suite passes 412 tests.


Administrators can now choose **Publish timetable** above the planning stages. The preview checks the saved shared revision, complete placements, clashes, compulsory student coverage, whole-school inclusion and active teacher accounts. Confirming publishes an immutable schedule snapshot and records the publisher, time and source draft revision. Staff cannot publish through either the UI or API.

Teacher and student schedules load the publication when they next load the MIS. The server also uses it for attendance lesson lists, Directory schedules, Classroom and cover availability. Further saves remain drafts. A changed draft, publication or managed school catalog invalidates an earlier preview. Uncertain publication retries use the same operation identifier.

Publication writes only the shared planning object. Existing class IDs remain stable; removed teaching allocations retain archived metadata for historical records. Attendance, assessments and Classroom files are not rewritten. Published memberships replace pre-publication enrollment overrides; subsequent deliberate admin enrollment edits still apply. Existing IDs cannot be repurposed for a different subject/year. Tutor group changes must first be saved in Administration. Publication requires a whole-school draft; partial phase publication and a future effective date are not yet supported.

The native server build leaves relative module imports unversioned so Node uses one mutable teaching catalog. Browser bundles retain content-hash release URLs for CDN caching.

# Full shared MIS deployment

Status: deployed and verified on 10 November 2026 at https://enderoth-learning-hub.web.app/wist-mis-testing/login.html. Cloud Run service `school-mis-vle` uses private shared storage. The Hub card is “School MIS and VLE — shared testing”.

The existing Node API provides the server-side permissions for attendance, assessments, Classroom assignments, quizzes, student hand-ins, marking, files, feedback, explicit grade transfer to the MIS, reports, messages, Directory, accounts, technical support, cover and option choices. Teacher calendar events, lesson plans and report-library preferences also have a shared workspace API. Published timetable allocations come from the integrated fixture. Timetable planning drafts now use a separate private shared store with autosave, revision checks and explicit import of earlier browser drafts; see [shared timetable planning](shared-timetable-planning.md).

## Storage and sessions

The backend stores its JSON records in a private Google Cloud Storage bucket using workload identity. Object-generation preconditions reject conflicting writes. No service-account key is sent to the browser. The dedicated runtime identity receives bucket-level object access only. Objects have versioning enabled for recovery.

Random session tokens are held in an HttpOnly, SameSite cookie; only their SHA-256 digests are persisted in the private session store. Login sessions, password revocation and logout work across server restarts. Firebase Hosting forwards only the specially named `__session` cookie, so deployment sets `WIST_SESSION_COOKIE=__session`. `WIST_PUBLIC_ORIGIN` enforces the public HTTPS origin for writes. The Learning Hub prefix is `WIST_BASE_PATH=/wist-mis-testing`.

## Prepare

1. Run `node scripts/build-shared-server.mjs build/full-shared-server /wist-mis-testing/` into a fresh directory. It stages runtime source, the integrated timetable, minimal static pages and 1,380 assessment fixtures. It includes no browser API emulator, development dependencies, local saved records, certificates or Google credentials.
2. Using the owner CLI identity, run `node scripts/migrate-shared-incidents.mjs build/full-shared-server/deploy/seed/directory.json`. This copies existing shared incidents and tutor/Head of Year assignments into the seed without deleting or changing Firestore. Refresh this snapshot immediately before cutover.
3. Link billing for project `economics-monopoly`. Cloud Run, builds, image storage and the private data bucket may incur usage charges. The deployment script stops before making infrastructure changes if billing remains disabled.

## Deploy and verify before cutover

Run `scripts/deploy-full-shared.ps1 -SourceDirectory build/full-shared-server`. It enables the required APIs, creates separate build/runtime identities, provisions the private bucket, and deploys `school-mis-vle` in `europe-west1`, with zero minimum instances and a maximum of one instance. The application itself still requires a school login.

Verify the Cloud Run service directly before changing the Learning Hub. Use independent teacher and student sessions to create an assignment, hand in work with an attachment, return feedback and transfer marks explicitly. Check a shared register and saved assessment from a separate staff session. Verify an unrelated student cannot read a peer's work, that a stale register save is rejected, and that a service restart retains both records and login sessions.

The regression `test/full-shared-workflow.test.mjs` exercises this workflow through two independent HTTP servers backed by one store. Additional tests cover teacher calendar privacy, workspace conflicts and import idempotency.

## Learning Hub cutover

Preserve the previous browser-emulated deployment and Hosting configuration for rollback. Replace that old client with the native server-backed client: `node scripts/build-shared-client.mjs build/full-shared-server/dist build/full-shared-client/wist-mis-testing RELEASE-ID`. Publish this static directory under `/wist-mis-testing/` on Firebase Hosting. Its app/login/worker bundles reduce module-loading round trips and use versioned immutable cache headers. Do not publish `demo-bootstrap.mjs` or `demo-api.mjs` in this directory. Add rewrites for `/wist-mis-testing` and `/wist-mis-testing/**` to Cloud Run service `school-mis-vle`, region `europe-west1`; static screen files use the CDN and `/api/` requests reach the backend. Leave every other Learning Hub route unchanged. Verify the root route and the forwarded `__session` cookie through the actual Hub URL.

Before final incident migration, run `node scripts/transition-incident-backend.mjs freeze` to put the previous Firestore incident collection and recipient assignments into read-only mode while retaining their read rules. This prevents old already-open browser tabs from writing to the previous backend after cutover. Run `node scripts/migrate-shared-incidents.mjs gs://economics-monopoly-school-mis-private --refresh-roles` to merge the final snapshot into the private shared Directory using generation checks, and then publish Hosting routing. Do not allow simultaneous writes to both incident stores. If cutover is abandoned, run the transition script with `unfreeze` and restore the archived Hosting configuration/client.

Staff and students then use the existing Learning Hub login URL, with the same fictional test usernames/numbers and passwords. Student sessions open Classroom; staff sessions open their MIS workspace. Administrator changes to account details and passwords are centrally stored.

## Existing browser-only records

The build preserves the old browser storage namespace, and does not delete IndexedDB or localStorage. Legacy teacher-workspace attendance, mark and report migrations continue through their validated APIs. Teacher calendar events, lesson plans and preferences import once into an initially empty shared workspace; later browser data never overwrites a newer shared workspace automatically.

Assessment and Classroom records held only in the old browser API's IndexedDB need a reviewed import from the existing **Export backup** output before retirement. Preserve those exports from test computers before cutover. They are not automatically uploaded wholesale: doing so would bypass record ownership, published/returned-state checks and conflict handling. The preserved browser demo is available at `/wist-mis-browser-backup/login.html`, linked from the shared login page. It reads the same old device-local namespace and uses no shared API bridge. Keep it available until those exports are reconciled.

This remains a fictional evaluation system with publicly documented test passwords. Use the production account and deployment procedures before introducing real school records.

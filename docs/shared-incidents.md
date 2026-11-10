# Shared incident deployment

The Learning Hub deployment uses Firebase Authentication and the existing Firestore database for incidents, rewards and tutor/Head of Year assignments. The rest of the hosted demo remains browser-local. The Node server deployment continues to use its existing server persistence.

Staff use the same fictional usernames and passwords as before. Internally, each provisioned staff identity has a Firebase email alias at `school-mis.invalid`; no email is sent. Students, parents and technicians are not provisioned for incident access. Existing browser-only staff sessions must sign in again after this upgrade.

On Incidents, **Import my earlier browser records** transfers the signed-in staff member's previous browser-only incident ledger to the shared store. It retains student IDs and levels, leaves the old browser records intact, and uses the same IDs to prevent duplicate imports. Each reporting teacher imports their own records; an administrator cannot impersonate another reporter.

Firestore enforces access, rather than relying on a browser role flag. Staff can create immutable incident records under their own identity and read entries they reported or that concern pupils assigned to them as tutor or Head of Year. Administrators can read all entries and assign recipients. An admin recipient change atomically updates the shared role map and staff pupil scopes, with a version check to reject overwrites from stale screens. Duplicate submissions use the same request ID. A failed shared save does not fall back to a browser-only save.

The shared pupil and staff catalog is a minimal fictional snapshot of the integrated timetable fixture. It excludes addresses, medical information, family contacts and passwords. Later changes to the local demo Directory do not automatically update this catalog or provision new shared staff identities. Shared account management for real school use is a separate deployment step. These public demo credentials are for fictional information only.

## Build and publish

1. Enable Firebase Email/Password Authentication in the project's Firebase console. Billing need not be enabled for the configured free-quota testing setup.
2. Sign in to Google Cloud CLI with the project owner identity. Set `MIS_FIREBASE_PROJECT` if using another project.
3. Place the public web-app configuration in ignored `tmp/firebase-web-config.json`. Run `node scripts/provision-shared-incidents.mjs`. It preserves existing Learning Hub security rules and recipient assignments, creates only missing fictional accounts, and does not reset existing passwords. It saves a rules backup under ignored `tmp/`.
4. Run `npm run build:shared-demo`. The checked-in `demo/shared-config.json` contains public client configuration only. No service-account key or admin token belongs in browser files or the repository.
5. Publish the resulting `build/shared/wist-mis-testing` directory at the same `/wist-mis-testing/` path.
6. Add a Hosting Content Security Policy for that path allowing `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com`. Keep the existing security headers and other Learning Hub routes unchanged.

The three dedicated Firestore collections have the `school_mis_incidents_v1_` prefix. Public registration is disabled, and other collections retain their previous rules. The standalone rule fragment is `demo/shared-incidents.rules`; it must be merged with existing project rules, never replace them wholesale.

## Acceptance checks

Verify a submission from one browser session is visible from an independently authenticated tutor session and a configured Head of Year session. Test an involved pupil's tutor too. Confirm unrelated staff, unsigned users, students and technicians cannot read the record through the database API. Check duplicate submissions, CSV export, stale recipient edits, and network failure handling. A fixture Year 09 Head of Year assignment to Isla Freeman is provided for cross-account testing; administrators can change it under Incidents → Tutors & Heads of Year.

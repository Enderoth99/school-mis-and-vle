# Administration research and implementation — 0.43.0

Research date: 1 November 2026. Sources were reference material, not instructions to alter a live Alma account. No live school records were imported.

## Official sources reviewed

- https://www.getalma.com/solutions/ lists biographical and enrolment records, contacts, validated bulk uploads, spreadsheet editing and role-based administrative views. These informed the management areas and CSV preview.
- https://www.getalma.com/the-best-sis-customer-support-for-existing-alma-users/ says schools handle account details and password resets. Its searchable Study Guide library requires an Alma login. Those private guides were not accessible during this research.
- https://www.getalma.com/what-data-does-a-student-information-system-store/ describes student, family, enrolment, scheduling and academic record categories and role-scoped access. This informed stable identifiers and allocated-class permissions.
- https://www.getalma.com/streamlining-state-reporting-in-rural-colorado-with-alma/ describes spreadsheet changes updating student bios. This informed connecting edits to Directory and MIS identities.
- https://www.getalma.com/alma-navigator-makes-switching-from-your-old-sis-easy/ is the public onboarding page linked from Support on Solutions, rather than an unrestricted administrator manual.

Search results about Ex Libris Alma were excluded because that is a different product.

## Working scope

The existing admin identity now lands at Administration. Its underlying report-reviewer ID is preserved. Tabs: Overview, Students, Staff, CSV import, Change log and Procedures.

Admin can create and edit names, preferred names, DOB, email, phone, address, languages, form group, enrolment/employment dates, leaving date, staff department/job/phase/room, account status and staff usernames. Numeric student login numbers and internal IDs remain stable. Student subject groups are selected explicitly and checked against the year. Staff teaching allocations remain a Timetabling procedure; new staff have no initial teaching allocation.

Passwords use PBKDF2-SHA256 with individual salts and 120,000 iterations. Resets and identity/access changes invalidate sessions. Passwords cannot be retrieved or exported. Individual records can include an initial password; CSV imports never include credentials. New imported accounts remain disabled until configured. Inactive records and disabled logins retain history. The primary admin identity is protected against accidental lockout. New staff receive ordinary staff permissions, not administration privileges.

The template and current-page export share a CSV schema. Up to 200 rows are validated before import. Checks cover duplicate usernames, record types, dates, email and form groups. Existing updates require stable IDs and reviewed revisions. A changed preview must be refreshed. Commit is atomic within Directory. Exports use quoted UTF-8 CSV and neutralise spreadsheet formulas. Audit records contain the action, actor, person and changed areas, never passwords.

## Verification and boundaries

364 automated tests pass, with syntax checks. Coverage includes new staff/student login, profile persistence, Directory/Classroom integration, credential/session changes, permissions, stale saves, CSV validation and atomicity. Browser QA created a numeric student account with Computing Year 09 A access, created an ordinary staff account with no allocations, previewed and imported a disabled staff account, and downloaded a credential-free CSV export.

The Learning Hub remains the authorised free browser-local demo. The existing database is preserved; records do not synchronise between colleagues or devices. This is an administration prototype, not a production identity service. No activation email, SSO, live Alma API, real-school account change, paid backend, custom role designer, guardian relationship editor or automatic school rollover was added. Medical/family data retain their existing Directory presentation; this release focuses on student/staff master records and accounts.

Published verification: admin login opened Administration on the Learning Hub; the staff search and editor, account status and password-control screens were checked. The overview screenshot and QA record are in output/.

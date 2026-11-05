# Family portal and course units — 0.21

## Family portal
Parent fixtures reuse the Directory's canonical household and guardian IDs. All 1,600 fictional guardian records have matching number-code logins. Parent test password: WistFamily2026!; Alex Ellis example: 301273.

Parents land directly in a read-only Family portal, with a linked-child selector, work/deadlines, returned Classroom feedback and grades, saved attendance, announcements and formally issued reports. Report snapshots have a branded print view. No provisional marks, quiz answer keys, student draft responses, medical details, internal attendance notes or report moderation tokens are exposed. Only issued report snapshots are listed; approval alone is insufficient. Current Directory relationships and active status are checked for each family read.

Node and browser-demo routing block parent accounts from Classroom and MIS APIs. Parent sessions use a separate fixture password. These are public fictional test credentials, not a production identity system.

## Course units
Teachers can order units, add introductions/files, choose release dates and prerequisites, and allocate assignments/quizzes to units. Students see clear lock explanations and completion progress. Reading-only units can be marked complete; units with assigned work require hand-in. Direct assignment links and parent work lists respect the same access rules. Concurrent sequence edits are checked within the store transaction to prevent cycles. Reusable assessments clear old unit/student restrictions when copied to another class.

## Validation
240 tests passed, plus syntax checks. Browser testing confirmed parent sign-in and released feedback, unit creation, student lock explanation and unlock after completion. Existing browser database namespaces and all saved records were retained.

The hosted release remains browser-local. No billing, shared-storage, email delivery or external assessment connections were enabled.

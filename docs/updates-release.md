# Classroom updates — 0.24.0

**Classroom → Updates** brings new work, returned feedback, announcements, portfolio reviews, discussions and class event changes together. Teachers get a **Needs my review** filter for marking, submitted portfolio entries and pending discussion replies. Each row links directly to the relevant assignment, portfolio entry, discussion or week. Marking and moderation are grouped to avoid one alert per student.

Unread counts appear in the Classroom navigation. Read/unread state belongs to the signed-in account and persists in the existing Classroom store. A revised source becomes unread again. Reading an update does not submit work, acknowledge assignment feedback, approve a review or transfer grades. Read reviews remain in Needs my review until the underlying task is completed.

Class, type and search filters, keyboard search, pagination, a first-six-items disclosure and marking the current page read reduce scrolling. The Refresh button fetches the latest state on demand. These are in-app updates; email, push notifications and external service connections are not enabled.

Visibility follows current classroom allocation, assignment audiences and release dates, course-unit locks, portfolio submission rules and discussion own-response gating. Cancelled published events generate an update; cancelled teacher drafts stay private. Read requests revalidate every source version inside the transaction. Invalid or stale batches cannot partially mark other items read. Teacher backups include only that teacher’s read state.

Validation: 266 automated tests and syntax checks pass. Browser checks cover student read/unread, teacher marking a review read without completing it, opening and approving a portfolio from the update link, the review disappearing after approval, the student receiving the result, and keyboard search with collapsed lists. Existing demo data remains in the same browser-local database; records do not sync between devices or colleagues.

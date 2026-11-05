# Private assignment help — 0.26.0

Students choose **Ask for help** from an assignment or quiz. The current draft is saved before opening the conversation; if saving fails, the work stays on screen and navigation stops. Both written responses and quiz selections are preserved. Asking for help does not turn work in or alter marks.

Each assignment/student pair has one private conversation, accessible to the student and allocated staff (including administrators). Students can write questions and attach up to two image, PDF, text or Word files, each up to 1 MB. Teachers can reply, reply and resolve together, or resolve/reopen separately. Students can reopen or confirm resolution too. New student messages reopen a request. Messages are not editable after sending. Longer conversations collapse older messages.

**Updates → Help requests** lists conversations by status, class and search. Teacher open requests appear under Needs my review; a teacher reply or resolution creates a student update. Update summaries contain no message bodies or attachment contents. Reading an update never resolves a request. Reply drafts are not sent until the user clicks Send; refresh/status actions preserve unsent drafts, and navigation uses the existing unsaved-changes guard.

Every read/write rechecks current classroom membership, assignment audiences, publication and release rules, including unit prerequisites. Conversation revisions are revalidated inside the transaction to prevent overwriting newer replies. Parent accounts and classmates cannot access these conversations. Staff backups remain class and current-membership scoped. No email, push or external service connection is used.

Validation: 285 tests and syntax checks pass. Browser QA verified written-draft preservation, quiz-answer preservation, question/image upload, teacher Update links, private reply and resolution, student notification, reopening, request filters and unsent-message protection. The existing integrated demo database is retained. Records remain local to each browser, so testing across roles requires signing in with test accounts in that same browser.

# Return and continue marking — 0.31.0

Teacher assignment/quiz reviews now show the number of submissions awaiting marking, a direct Next awaiting marking link and a **Return & next** action alongside the ordinary return button. It uses the existing grade/quiz-grade action, including mark validation, rubric/question awards and submission revision checks. Only after that action succeeds does it refresh the assignment detail and select the next handed-in response without returned feedback. The queue follows roster order and wraps, skipping missing work, saved drafts and already returned submissions.

When the queue is empty, the current returned response stays open and a clear completion message appears. If the follow-up lookup fails, the teacher is told the feedback was saved and to refresh Student work; it does not attempt to return the grade again. Forms reject a second submission while their first request is in progress. Returning feedback continues to leave MIS transfer under explicit teacher control.

Validation: 308 automated tests and syntax checks pass. Queue tests cover roster order/wrap, resubmissions, missing/draft/returned work, empty queues and read-only selection. Browser QA used two fictional student hand-ins, returned Jamie Hayes's response and automatically opened Taylor Bennett, then returned Taylor's response and confirmed zero awaiting marking. Classroom returned counts increased while the existing matching MIS score count stayed unchanged. Existing browser-local records and database identifiers are retained.

Live verification also exposed a sign-in startup race. Version 0.31.1 keeps the submit button disabled until its JavaScript handler is attached and sets method=post as a fallback, preventing early native GET submission of the demo credentials.

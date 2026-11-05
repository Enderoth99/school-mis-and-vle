# Individual reading follow-up — 0.41.0

Student names in Materials → Class reading overview now open a compact reading detail page for that pupil and class. The page lists currently available materials with current-version confirmation state and last confirmation date. It defaults to outstanding reading, with all, confirmed and updated filters. Material titles open the guide and existing class confirmation report. A back link returns to the class overview.

The endpoint checks staff class allocation and current pupil enrolment. Students, parents and unallocated staff are denied. Archived and other-class materials are excluded; no read state, grade, assignment or notification is modified by viewing the page. Teachers cannot confirm reading for pupils.

Validation: 345 automated tests pass, syntax checks pass. Local browser navigation verified Alex Harper's updated CPU guide and its material report link, plus empty confirmed-filter feedback. The demo still saves in this browser only.

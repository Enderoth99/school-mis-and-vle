# Filtered marking inbox — 0.32.0

The Classroom To mark page now has an As of date, status, allocated-class and student/task/class search filter. Views distinguish pending marking, resubmissions, late unmarked work, missing work and returned scores that differ from MIS. Results show twelve rows per page; pagination retains date, status, class and search. Totals are labelled as covering all classes, separately from the matching-result count. Empty results offer a clear explanation.

The page consumes the existing role-scoped dashboard response and never mutates submissions or grades. Open work links select the named student's response; returned-score links open the existing explicit MIS preview. Students do not receive the marking inbox UI. Search is bounded and case-insensitive; malformed page offsets safely reset, and out-of-range offsets clamp to the last page.

Validation: 310 automated tests and syntax checks pass. New classification and pagination tests verify combined filters, disjoint pages, bounded offsets and read-only selection. Browser QA found one CPU task by class/search, found Jamie Hayes under Ready for MIS, opened the transfer preview without applying it, and paged a 24-row missing-work list while retaining its class and as-of date. Existing browser-local demo records remain unchanged by filtering.

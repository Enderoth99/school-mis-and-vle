# ACTS-inspired WIST timetabling: evidence and boundaries

Research date: 31 October 2026 (Asia/Tashkent).

The user supplied [ACTS Timetable: Complete Video Guides](https://www.youtube.com/playlist?list=PL_x1SmX272F8RaNaykDQBz15wYGnajgy3), by Yong Barba. This is ACTS Timetable, not aSc Timetables. The implementation uses original WIST branding and independent scheduling code.

## Review performed

REA launched fresh temporary Chrome profiles and loaded the six supplied playlist videos. Selected workflow segments were played and captured with screenshots, rendered accessibility text and page metadata. Chapter lists/descriptions supplied additional workflow context. Captions were reported unavailable in the sampled players. This was a sampled visual review, not a complete transcription or a claim to have watched every minute.

| Video | Sample | REA evidence |
|---|---|---|
| [Room energy/time-off](https://www.youtube.com/watch?v=DUi9ekTgE3I) | 0:57; room-edit availability matrix | `ev_b4fa82676959061dfdcfd6457f6d566124f6715d86812f7e6169bac283ff5559` |
| [Plotting-board guide](https://www.youtube.com/watch?v=jAmbdR6ym3E) | 1:02; resource tabs, time rows, day columns, unassigned cards | `ev_f5a61854d5c8eaf336ba2732fdfacefd725b9f8385846edfd0980cc6c081b8a6` |
| [Large-data demonstration](https://www.youtube.com/watch?v=SnJiMbDnM7Q) | 7:32; teacher load and room-capacity panels | `ev_c4e80ae8733d6dec8dfe1e7b1815939cdff8f9428fba7263df73dc5689e5b3a9` |
| [Whole-school walkthrough](https://www.youtube.com/watch?v=OA4g4prPmNM) | 6:41; teaching-load distribution and grouped assignments | `ev_871b6948f13047fdb2e8141a615645f8b7da49656af7aa650867bfc5af54bafa` |
| [End-to-end walkthrough](https://www.youtube.com/watch?v=sJod5hSnW0k) | 3:32; school configuration; chapter list describes data/load/board workflow | `ev_b156b0862072fe9cb04ca2c818658353aa9667c1ba6659b0d1037cea6dbc473e` |
| [Product introduction](https://www.youtube.com/watch?v=-dERz7daGqs) | 3:41; populated master board and card layout | `ev_cbea1a53cd750b04f266e8fe88c77f34497c7c4b49ef025d208c71321fc81ad9` |

Initial playlist discovery: `ev_1a0f41d2ba8c17344764d2f1b55d9b360d243a9675399c0eb3db0226c733ec6f` established six video identities and the correct product. Complete retained evidence was exported to `output/acts-rea-evidence.json`. Browser cleanup was reported as termination of the provider-owned processes.

The accessibility tree describes the YouTube page, not controls inside the video. Video pixels support the interface observations; descriptions/chapter titles support the reported tutorial topics. These captures are not observation of the ACTS application executing, nor proof of the creator's speed, optimality, energy-saving or conflict-free marketing claims. No ACTS account was created, subscription accepted, binary inspected or proprietary algorithm recovered.

## Reconstruction choices

The visible three-stage sequence maps to Data input, Load distributor and Plotting board. Time-off and checks/analytics are explicit WIST tabs. WIST uses the same canonical student, class and teacher identifiers as the MIS, while storing planning changes separately. The board supports section/teacher/room views, manual moves, native drag/drop, locks, unassignment, generation, undo/redo, CSV, backup/import and browser printing. Parallel mixed sets are summarized in a cell and individually inspectable, rather than incorrectly treating all members of a form as one indivisible class.

The constraint engine independently checks teachers, rooms, actual student memberships, capacity, eligible rooms, unavailable slots, daily teacher loads, spreading and consecutive lessons across break gaps. Its generator is bounded, deterministic heuristic search. It never silently accepts a collision to report completion. An infeasible or exhausted search leaves cards unassigned. ACTS's proprietary AI, automatic expertise-based teacher assignment, smart ripple displacement, timetable polishing, substitutions and claimed energy optimization have not been reproduced. Room time-off enforces closure windows; it does not predict energy bills.

## Validation

All 106 tests pass: 86 existing tests, six fixture tests and fourteen engine tests. The default Year 09 pilot preserves 58 pupils, four forms and 120 weekly cards (30 periods per pupil). The engine and real browser both completed it with zero reported constraints. The secondary fixture has 324 pupils, nineteen forms and 544 cards; a real worker run completed it in approximately 3.5 seconds on this test machine. These timings are measurements, not guarantees. A whole-school benchmark placed 1500 of 1504 cards within the configured budget, explicitly reporting four unassigned cards.

Browser checks verified reload persistence, room blocking creating an occupied-slot conflict, refusal of an invalid move, locked-card preservation during clearing, undo restoration, load edits creating the correct number of unassigned cards, and JSON backup export. A Focus board mode reduces scrolling. Larger plans or all-resource views can still require scrolling and manual revision.

## Colleague-test isolation

Published preview: `https://enderoth-learning-hub.web.app/wist-timetabling/`. The existing `/wist-mis/` colleague demo is unchanged. The preview has a separate IndexedDB database and MIS local-storage key; timetable plans are browser-local. The original landing catalogue is unchanged. The preview includes a solved fictional pilot without overwriting an existing visitor's saved planning draft. No paid service or shared server was provisioned. Nothing is automatically applied to attendance, grades or the existing sample weekday timetable.

## School-rule correction · 31 October 2026

The earlier 30-period completion measurements above describe v1 only and are superseded. Rules v2 requires 40 occupied teaching periods for every pupil through Year 11, PE doubles that cannot cross breaks, and synchronized Year 10/11 option alternatives with exactly one choice per pupil. Years 12/13 alone may have frees. Registration is separate. The supplied screenshots determine the Y7–9 subject totals and corrected period times; option combinations remain illustrative pending the school’s full lists.

The default pilot now has 156 cards (160 teaching periods). A bounded two-attempt/30k search places 150/156 with no hard clashes and 87 missing compulsory student-periods. This is an incomplete planning draft. Existing mixed-set staffing is not silently replaced to fake a solution. Whole-school warnings include teacher demand and sports-space supply. Student view labels compulsory gaps Missing and permitted sixth-form gaps Free; coverage analytics lists each pupil. Option bundles move/schedule atomically and PE singles are rejected. Existing v1 drafts offer Apply school rules, retaining a browser backup and compatible placements.

All 123 tests pass (86 existing, 9 fixture, 26 engine, 2 migration tests). Browser QA verified v1 upgrade, 2-period PE cards, corrected break times and worker generation. A longer browser search placed 155/156 and reported 14 compulsory student-periods missing, while the selected pupil had 40/40. This is not a complete year-group solution. The updated preview is isolated from the colleague’s MIS; it seeds a partial rule-compliant draft rather than claiming completion.

## 2025–26 option document · rules v3

Source: user-supplied Downloads/Timetable options 2025_26.docx, SHA256 C8CF435E97F495CB2857F32519C898413A2C125E500A9B93EA3B2B4D7EF1C9DB. The document contains four alternative TT Models, not one final selected model. Its OOXML tables were read in row/column order, including Model 4 embedded within the third table. Subject abbreviations are expanded for display; repeated subject offerings in different columns are retained. Model 3 reuses the earlier ** eligibility-marker meaning. Model 4 French (C) and RSL (G) are unstarred and unrestricted; Textiles is offered in E.

The user's four-lessons instruction applies to the Year 10/11 document blocks A–I (nine subjects × four = 36) and existing sixth-form teaching subjects. Y7–9 screenshot allocations remain unchanged. Year 10/11 add assembly 1, PSHE 1 and PE 2 to reach 40. All four document models are selectable independently for each year; Model 1 is the initial default pending a preferred-model answer. English/mathematics preserve canonical mixed-set rosters. Other option enrollments are fictional, balanced test choices, with no duplicated subject and at least one science. Non-Uzbek eligibility flags are synthetic fixtures, not pupil nationality. Textiles uses an existing Art curriculum teacher, an explicit staffing assumption requiring school confirmation.

Document models are not a solved school timetable: resource/student clashes, gaps and search exhaustion remain visible. Option checks enforce four single cards, offered subject/block membership, mandatory science, no duplicate subjects and marked eligibility. Pupil choices and existing MIS attendance/grades are not rewritten. A new Option blocks tab presents the source combinations and model selectors. Existing drafts retain a backup before applying v3; switching models clears option placements and preserves compatible other placements/availability.

All 128 tests pass, including five document-option tests. Tests compare every model against literal column transcriptions, cover all pupil choices across all models, reject invalid hours/science/eligibility, preserve sixth-form memberships, and check migration. Browser verification covered independent Model 4/3 selection, Textiles, reload persistence and creating a Secondary scope retaining those selected models.

The published document-options page was checked with both year tables side by side, allocated fixture pupils, four lessons per block and model selectors. The separate colleague MIS assets and landing files were verified byte-for-byte unchanged. A bounded Secondary benchmark (2 attempts/30k nodes) placed 270/769 cards with no hard clashes and 7734 compulsory student-periods missing; it is explicitly incomplete, not a solved timetable. The wider option model adds a substantially harder scheduling problem than the Year 09 pilot.

## Single demonstration for 2026–27
The user selected Model 1 and clarified this is a demonstration in preparation for 2026–27 option changes. The public interface now uses Model 1 for both Years 10/11 with no model selector. Historical alternatives remain internal reference/test fixtures. New scopes and imports use the demonstration profile. Saved Model 1 drafts receive year labels without losing activities/placements; alternate-model drafts are backed up before converting to Model 1. Eight focused option/migration checks pass, including an idempotent profile conversion and preservation of existing Model 1 placements. This supersedes earlier notes describing four publicly selectable models.

## Scheduled secondary demonstration and slot diagnostics

The plotting-board continuation adds a reproducible secondary snapshot at dist/timetable-demo.json (scripts/build-timetable-demo.mjs), now the first-visit seed for the isolated public preview. Existing saved drafts are retained; Load scheduled demo backs up the current draft before replacing it. The selected sample pupil has 40/40 periods, including a Thursday P7–8 PE double. The whole plan remains explicitly incomplete: 702/769 cards, 67 unassigned and 1285 compulsory student-periods missing, with zero hard clashes. No pupil, teacher, room or option rule was changed to hide those gaps.

The engine now rejects teacher/student conflicts before exploring room permutations, including internal bundle conflicts. An equivalent secondary search formerly placed 270/769 under a small budget; the 8-attempt/100k run now places 702/769 in approximately 2 seconds on this machine. No speed or completion guarantee is implied. A more expensive experimental repair search did not improve the result and was not shipped. A better existing valid partial draft is retained if a later bounded generation cannot improve it.

Find slots checks every start time against current placements and proposes valid room assignments, moving option partners together. It explains blocked times and links conflicting cards. Searches are bounded and report exhaustion. Browser QA removed the selected pupil’s PE double, found the one valid Thursday P7 start, reapplied it and verified both periods, 40/40 coverage and restoration to 67 unassigned cards. Thirty engine tests pass, including new read-only diagnosis, room-search pruning, double/lock/budget checks and preservation of better drafts. The full suite passed 132 checks before the final additional retention regression, which also passes.

Final verification: all 133 tests pass. The published preview includes the scheduled secondary snapshot and slot diagnostics. The selected demonstration pupil’s restored PE double covers Thursday P7–8. Existing colleague MIS and landing assets remain unchanged.

## Manager workflow reconstruction

The retained ACTS videos were audited specifically for the manager's route (docs/acts-manager-workflow.md). Observed school settings and the Data Input → Load Distributor → Plotting Board spine guide the new UI. The ACTS-like load screen has teacher utilization, subject/room distribution checklists and Quick Assign for subject, eligible teacher, section(s) and optional room. Exact ACTS import formats, expertise ranking and automatic allocation algorithms remain unknown; the new review gates and content fingerprints are independent WIST design choices.

The public route now starts at School week, then People & rooms, Student options, Teaching loads, Constraints, Validate inputs and Generate & refine. Managers can add/edit planning teacher profiles/eligibility, add planning subjects and rooms, edit student Model 1 choices, preview and commit teacher/room assignment to multiple existing groups, and inspect exact mixed-set memberships. English/mathematics sets and canonical pupil IDs stay fixed. No planning teacher creates a MIS login. Actual changes clear affected unlocked option-block placements atomically; locks prevent accidental changes. New drafts are backed up before starting with unplaced cards and fixed assemblies.

Reviews are saved against relevant input content; editing inputs invalidates dependent reviews, while moving lessons preserves input reviews. Input blockers include bad references/times, capacity shortfall, declared eligibility problems, duplicated teachers in parallel choices and impossible fixed/PE constraints. Movable clashes and incomplete pupil coverage remain warnings for generation and still prevent a finished timetable. Validation hands off to the board with cancelable generation, preserving a better valid draft. This does not claim all 769 cards can currently be solved.

All 154 tests pass (including 10 manager input tests and 11 workflow/readiness tests). Browser QA verified school-week/data reviews, adding a planning Computing teacher, previewing/committing a 2-period class load and undoing it, editing/undoing a student choice, zero preflight blockers despite the 67 unassigned cards, and validation→generation→board handoff. Generation retained 702/769 placements, with 67 cards and 1285 compulsory student-periods still missing. The manager UI keeps high-volume lists in separate scrollable columns and uses compact stage navigation.

Final UI audit preserved Quick Assign list scroll/focus across changes and made replacement of existing/co-teachers explicit in the assignment preview. The preview lists prior teachers, projected workload and exact count of cards to be unassigned. Manager generation opens the board so progress and cancellation stay visible. These controls are independent reconstructions based on the bounded retained ACTS workflow evidence.

Final layout QA confirmed the Quick Assign preview stays within the viewport and selecting Year 09 D retains checkbox-list scroll (112px) and keyboard focus. Repeated setup metrics were removed in favor of the existing one-line project summary. Assignment previews and generation actions remain visible without scrolling through the input form.

# Forms question library

Release: 20261101-question-library-v1. Research and implementation: 1 November 2026.

## Reference catalogue

[Google's question-type catalogue](https://support.google.com/docs/answer/7322334?hl=en) lists short answer, paragraph, multiple choice, checkboxes, dropdown, file upload, linear scale, rating, multiple-choice grid, checkbox grid, date and time. [Microsoft's form creation guide](https://support.microsoft.com/en-us/forms/create-a-form-with-microsoft-forms) covers choice, text, rating, date, ranking, Likert, file upload, NPS and sections. All of these main question families have corresponding local controls in this release.

[Microsoft's maths quiz guide](https://support.microsoft.com/en-us/forms/create-a-math-quiz-in-microsoft-forms) informed the equation-entry workflow. [Google's media guide](https://support.google.com/docs/answer/2839737?hl=en) informed question/choice image support and separate video resources. Formula rendering uses a locally served, MIT-licensed [KaTeX 0.19.1](https://katex.org/docs/browser) module with MathML output, no external runtime fetches, trusted-HTML mode disabled and bounded expansion.

## Implemented controls

| Family | Local options and marking |
| --- | --- |
| MCQ, dropdown, true/false | One selection; answer key; optional question/choice images; automatic marking |
| Checkboxes | Multiple selections; exact-set answer key; automatic marking |
| Short answer | Optional accepted-answer list; case/spacing-normalised exact matching, otherwise teacher marking |
| Paragraph | Teacher-only model answer/guidance; teacher marking |
| Maths | LaTeX question/choice text, equation preview and symbol templates; decimal/fraction/root/power answers with numeric tolerance, or algebra/working for teacher review |
| Missing words | `[[answer|alternative]]` authoring; student payload contains numbered gaps rather than answers; proportional marks for correct gaps |
| Drag words | Word bank with distractors; native drag/drop plus type/click alternatives; proportional gap marks |
| Matching / connectors | Pairs join with visible lines; drag, click-pair and dropdown controls; proportional marks for correct pairs |
| Ranking | Native drag ordering plus up/down controls; desired order stays private; exact-order marking |
| Multiple-choice and checkbox grids | Rows/columns, optional per-row key, optional one-use-per-column rule; proportional row marks when keyed |
| Likert | Matrix response; normally unscored; optional teacher marks or answer key |
| Scale, rating and NPS | Bounded numeric responses, end labels, star/heart/thumb rating symbols; NPS range fixed to 0–10 |
| Date, date/time, time and duration | Structured input and server validation; optional exact accepted answers |
| Student files | Configurable allowed extensions and 1–3 files; 1 MB/file and 8 MB/request total; teacher downloads and marks responses |
| Section / instructions | Unscored heading and description blocks, including image/formula support |
| Image / diagram | Teacher-uploaded PNG/JPEG/WebP; validated raster signatures; alt text; no SVG/HTML uploads |
| Video | HTTPS resource opens in a separate tab; no third-party video cookies or embeds loaded automatically |
| Connected activity | Named Google Forms, Microsoft Forms, Desmos, GeoGebra, PhET, Microsoft 365, Google Drive and custom HTTPS resource links; response collected locally |

Every scored item supports points, required status, descriptions, question images, maths display, and correct/incorrect feedback. Teachers can duplicate, remove and reorder questions using handles or arrow controls. Draft editing preserves image data and typed matching-pair configuration.

Zero-point forms collect and return responses without manufacturing a percentage or an invalid MIS assessment. Returned scored results remain in Classroom until a teacher previews/selects them with Add scores to MIS. Existing grade revisions and student-work revisions are checked before a transfer; other pupils' marks are preserved.

## Deliberate boundaries

This covers the main question catalogue and the requested exam interactions. It is not a complete reimplementation of every Google/Microsoft product setting. Conditional branching, provider-specific AI equation suggestions, full symbolic-equivalence checking, survey analytics dashboards, third-party add-on marketplaces and collaborative form editing are not included.

Connected-activity controls are working HTTPS links; live OAuth/LTI provider connections, background synchronisation and external Forms score imports require a configured school service and authorisation. They are not represented as connected accounts. Matching “connectors” are a separate, fully local question type.

Numeric maths auto-marking does not execute user JavaScript or use `eval`. Algebraic expressions only auto-match explicit accepted text; mathematical equivalence and method marks require teacher review.

The Learning Hub remains the agreed fictional browser-local demo. Class access is enforced by the API implementation, but the public static fixture environment is not a production examination-security boundary. No database IDs were changed and no existing test records were reseeded or removed.

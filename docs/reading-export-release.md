# Reading report search and export — 0.40.0

Materials → Class reading overview now includes an instant student-name search and Download filtered CSV. The search intersects the chosen confirmation status. CSV contains only displayed students, with class name, confirmed and available material counts, outstanding confirmations and updated-material count. It uses UTF-8 BOM, quoted cells, CRLF rows and spreadsheet formula neutralisation. Empty results show a clear message and disable download.

Existing staff allocation checks remain unchanged; no server upload, grade write or message is triggered. Saved demo data remains browser-local.

Validation: 343 automated tests and syntax checks pass. Browser QA searched Harper, filtered Updated, and downloaded a CSV containing only Alex Harper. An unmatched name disabled the download.

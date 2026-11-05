# Technical support — v0.45.0

Staff enter task title, location, issue details, dates, technician assignment, asset reference, category, priority, checklist and up to three 1 MB attachments in one submission. Staff see their own tickets; technicians and the existing admin see the central board. Technicians sign in directly to support and cannot access other MIS endpoints.

Board order: No Task (completed), To Do, In Progress. Completed tickets require resolution notes and retain completion timestamps. Reopening preserves activity history. Technician drag and drop opens the task editor for review before saving. Also includes grid, due-date agenda/calendar, charts, filters, comments, per-task history and activity CSV. Files download as attachments, without inline HTML execution. No external Microsoft connection or email delivery.

Two fictional technician fixtures are added idempotently to Directory: sam.turner / WistTest2026! and priya.shah / WistTest2026!. Admin can edit profiles, disable access and reset passwords. They are excluded from teaching allocations. Individual passwords use the existing account registry. The demo namespace remains wist-mis-integrated-browser-demo-v2.

Support tasks and activity live in Directory's transactional state, preserving existing records; optimistic revisions reject stale edits. Browser demo data remains local to each browser. A shared multi-user backend remains necessary before using this as a real departmental support desk.

Validation: 377 automated tests pass, including five support tests for role restrictions, ownership, lifecycle, stale writes, validation and HTTP access. Browser QA verified teacher submission, technician login, progression, checklist completion and completed-board retention.

Reference: Microsoft Planner's relevant fields and board workflows were reviewed at https://support.microsoft.com/en-us/planner/training/organize-your-team-s-tasks-in-microsoft-planner and https://learn.microsoft.com/en-us/office365/servicedescriptions/project-online-service-description/microsoft-planner-service-description . The screenshots supplied the workflow/layout reference; the MIS remains self-contained.

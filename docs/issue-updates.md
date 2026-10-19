# Automatic updates and shared issue support

Signed-in issue and notification views refresh automatically. The next check is scheduled 15 seconds after the preceding refresh completes. Hidden tabs stop fetching; returning focus or making the tab visible refreshes immediately, with at most one automatic refresh in flight. Slow networks extend the interval. This is authenticated polling, not a WebSocket subscription. No new database access is granted to browsers.

Logout and view changes abort obsolete requests. A background result that predates a user action is ignored. A failed refresh leaves the previous results visible and shows a retry message. Account management and password forms do not poll issue feeds.

Campus-visible issue details offer students an “I’m facing this too” button and a way to remove their support. The server accepts an explicit desired state, not a toggle. A composite primary key prevents duplicates, including concurrent requests. Only the authenticated student ID is used. Counts appear in feed rows and details; no supporter list or IDs are returned. Private issues cannot receive support. Staff and admin roles remain unable to add support; only admins manage resolution. Support writes are limited to 20 per student per 15 minutes.

`supabase/schema/issue_support.sql` adds the server-only support table and extends the existing issue workflow. It does not modify authentication. `tests/issue-support.sql` checks permissions, idempotency, counts, privacy and removal in a rolled-back transaction. `tests/issue-refresh.mjs` checks lifecycle behavior without a browser. `tests/issue-support-live.py` verifies two-account API behavior and restores the sample issue’s initial support state.

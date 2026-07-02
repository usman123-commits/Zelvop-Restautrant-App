# Frontend Failure UX

Describes how the client behaves when requests fail, and what the user is
guaranteed to see. Backend failure semantics are owned by
`docs/backend/failure-modes.md`; this document covers only the user-facing
surface.

---

## Network failure behavior

The client has **no explicit offline detection** and no separate "offline" UI
state. A lost connection surfaces the same way as any other request failure:
the request rejects and the screen follows its error path below. There is no
offline cache and no queued/deferred writes — an action taken while offline
fails rather than being stored for later.

---

## Per-surface failure handling

| Surface | On failure | User visibility |
|---------|-----------|-----------------|
| Login / Sign Up | submission rejected | **Blocking** inline error text; user stays on the form |
| Forgot Password | request rejected | Alert dialog with the error |
| Order Detail (load) | fetch rejected | Alert dialog; screen stays in loading/empty |
| Order actions (accept/decline/pickup) | action rejected | Order stays in prior state; error surfaced via the detail screen's error alert |
| Confirm Delivery (upload/submit) | request rejected | Alert dialog; user remains on the confirm screen to retry |
| Home stats / unread count | fetch rejected | **Silent**; that widget is simply absent/zero |
| Orders list (load) | fetch rejected | List stays empty; no dialog |
| Notifications (load / mark read / mark all) | request rejected | **Silent**; list unchanged |
| Alerts tab badge (interval poll) | fetch rejected | **Silent**; badge unchanged |
| Session restore (cold start) | refresh rejected | Session ends; user routed to Login |

---

## Blocking vs silent failures

- **Blocking (user is told and must react):** authentication (Login/Sign Up),
  Forgot Password, Order Detail load, order actions, and Confirm Delivery. These
  present an inline error or alert and do not advance the flow.
- **Silent (no user-facing error):** Home stat/unread widgets, Orders list load,
  the Notifications screen requests, and the Alerts badge poll. These degrade to
  an empty/unchanged view without notifying the user.

---

## Retry mechanics

There is **no automatic retry or backoff** for failed requests. Recovery is
user- or interval-driven:

- **Pull-to-refresh:** Home, Orders, and Notifications reload on manual pull.
- **Re-submit:** Login, Sign Up, Forgot Password, order actions, and Confirm
  Delivery can be retried by repeating the action.
- **Interval refresh:** the Alerts tab badge re-fetches the unread count on a
  fixed interval while the app is open; a failed poll is retried on the next
  tick.

---

## User-visible error guarantees

- Actions that change order state (accept, decline, pickup, deliver) will not
  silently appear to succeed on failure: the order remains in its prior UI state,
  and the failure is surfaced through the owning screen's error path.
- Authentication failures always keep the user on the auth screen with a visible
  message; they never partially sign a user in.
- Read-only, non-critical widgets (dashboard stats, notification badge/list) may
  fail silently and show empty/stale data rather than interrupting the user.

Actual server-side guarantees (idempotency, partial-write behavior) are defined
in `docs/backend/failure-modes.md` and `docs/backend/invariants.md`.

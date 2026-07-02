# Frontend Screens

Describes user-visible behavior of each screen in the rider app. Business rules,
validation, and entity lifecycles are owned by the backend docs
(`docs/backend/`), not this document.

Roles: this app is used by **riders** only. Owner-facing behavior is out of scope.

---

## Splash

- **Purpose:** Bridge shown while the app restores persisted session and
  initializes auth.
- **Entry conditions:** Rendered automatically on cold start, before any route
  is resolved.
- **Required data:** None (waits on persisted store rehydration).
- **UI states:**
  - Loading: the only state (logo + tagline while initializing).
- **User actions:** None. Automatically replaced once initialization completes.

---

## Index (entry redirect)

- **Purpose:** Decide the first real screen based on session presence.
- **Entry conditions:** Root path `/`.
- **Required data:** Persisted auth token.
- **UI states:** None visible (immediate redirect).
- **User actions:** None. Redirects to Home if a token exists, otherwise Login.
  See `navigation.md`.

---

## Login

- **Purpose:** Authenticate an existing rider.
- **Entry conditions:** No active session, or user signed out.
- **Required data:** None on entry. Collects email + password.
- **UI states:**
  - Default: form ready.
  - Loading: submit shows a spinner; submit disabled.
  - Error: inline error message text when authentication fails.
- **User actions:**
  - Submit credentials -> on success, session starts and user is routed to Home.
  - Toggle password visibility.
  - "Forgot Password?" -> navigates to Forgot Password.
  - "Sign Up" -> navigates to Sign Up.

---

## Sign Up

- **Purpose:** Register a new rider account.
- **Entry conditions:** Reached from Login.
- **Required data:** None on entry. Collects name, email, phone (optional),
  password, confirm password.
- **UI states:**
  - Default: form ready.
  - Loading: submit shows a spinner; submit disabled.
  - Error: inline error text (from local checks or backend rejection).
- **User actions:**
  - Submit -> on success, session starts and user is routed to Home.
  - Toggle password visibility.
  - "Login" -> returns to Login.
- **Notes:** The screen registers a rider account. There is no role selector.

---

## Forgot Password

- **Purpose:** Request a password reset for an email address.
- **Entry conditions:** Reached from Login.
- **Required data:** None on entry. Collects email.
- **UI states:**
  - Default: form ready.
  - Loading: submit shows a spinner; submit disabled.
- **User actions:**
  - Submit -> shows a confirmation dialog, then returns to the previous screen.
  - "Back to Login" -> returns to the previous screen.
- **Notes:** The confirmation message is intentionally identical regardless of
  whether the email exists (see `docs/backend/invariants.md`).

---

## Home (tab)

- **Purpose:** Rider dashboard: availability, at-a-glance stats, current active
  delivery, and recent deliveries.
- **Entry conditions:** Active session. Default tab after login.
- **Required data:** Rider stats, the rider's orders, unread notification count.
- **UI states:**
  - Loading: pull-to-refresh spinner while fetching.
  - Populated: stats cards, optional active-delivery banner, recent list.
  - Empty (recent): placeholder shown when there are no delivered orders.
  - Partial: stats, active banner, and recent list load independently; any one
    may be missing without blocking the others.
- **User actions:**
  - Toggle availability (online/offline).
  - Tap notification bell -> Notifications tab.
  - Tap active-delivery banner / "View Details" -> Order Detail.
  - "See All" -> Orders tab.
  - Tap a recent order -> Order Detail.
  - Pull to refresh -> reloads stats, orders, and unread count.

---

## Orders (tab)

- **Purpose:** List the rider's orders with filtering, and act on new orders.
- **Entry conditions:** Active session.
- **Required data:** The rider's orders.
- **UI states:**
  - Loading: spinner on first load; pull-to-refresh spinner thereafter.
  - Populated: filtered order cards.
  - Empty: placeholder when the active filter yields no orders.
- **Filters:** Active, New, Completed, All (client-side over already-fetched
  orders).
- **User actions:**
  - Switch filter chip.
  - Tap an order card -> Order Detail.
  - On a New order: Accept, or Decline (with confirmation dialog).
  - Pull to refresh -> reloads orders.

---

## Notifications / Alerts (tab)

- **Purpose:** Show the rider's notifications and let them mark as read.
- **Entry conditions:** Active session.
- **Required data:** The rider's notifications.
- **UI states:**
  - Loading: full-screen spinner on first load.
  - Populated: notification list with unread indicators.
  - Empty: placeholder when there are no notifications.
- **User actions:**
  - Tap a notification -> marks it read; if it references an order, navigates to
    Order Detail.
  - "Mark all read" -> clears all unread indicators (shown only when unread > 0).
  - Pull to refresh -> reloads notifications.

---

## Profile (tab)

- **Purpose:** View/edit account details, control availability, view app info,
  and sign out.
- **Entry conditions:** Active session.
- **Required data:** Current user from session.
- **UI states:**
  - View: read-only account details.
  - Edit: name/email/phone become editable with Save/Cancel.
  - Saving: Save shows a spinner.
- **User actions:**
  - "Edit" -> enter edit mode; "Save" persists changes, "Cancel" discards them.
  - Toggle availability (online/offline).
  - Tap App Info rows (Terms, Privacy) -> no destination wired.
  - "Logout" -> confirmation dialog, then ends the session.

---

## Order Detail

- **Purpose:** Full view of one order with a status timeline and the actions
  available at the current status.
- **Entry conditions:** Active session; an order id supplied via route param.
- **Required data:** The order identified by the route param.
- **UI states:**
  - Loading: full-screen spinner while fetching (also shown if the order is not
    yet in memory).
  - Populated: timeline, customer, items, and status-appropriate action bar.
  - Error: an alert dialog is shown if the fetch fails.
- **User actions (status-dependent):**
  - New (assigned): Accept (confirmation) or Decline (reveals a reason field,
    then submit).
  - Accepted: Mark Picked Up (confirmation).
  - Picked up: Mark Delivered -> Confirm Delivery screen.
  - Call, WhatsApp, and Open in Maps launch external apps (see `navigation.md`).
- **Notes:** Legal status transitions are defined in
  `docs/backend/state-machines.md`; this screen only exposes actions valid for
  the current status.

---

## Confirm Delivery

- **Purpose:** Capture delivery proof and confirm completion of a picked-up
  order.
- **Entry conditions:** Reached from Order Detail for a picked-up order. Receives
  order id, order number, customer name, total amount, and payment method as
  route params.
- **Required data:** The route params above.
- **UI states:**
  - Default: photo area, notes field, and (for COD) a cash-collection card.
  - Uploading/submitting: confirm button shows a spinner and is disabled.
  - Blocked: for COD orders, confirm is disabled until the cash checkbox is
    checked.
  - Success: an alert confirms delivery, then routes to the Orders tab.
  - Error: an alert dialog is shown on failure.
- **User actions:**
  - Take a delivery photo (optional; requires camera permission).
  - Enter delivery notes (optional).
  - For COD: toggle the cash-collected checkbox.
  - Confirm Delivery -> completes the order.
  - Cancel / back -> returns to Order Detail.

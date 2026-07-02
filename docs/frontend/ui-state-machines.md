# Frontend UI State Machines

Describes the UI states and transitions the user experiences in async and
interactive flows. The authoritative order/domain state machine lives in
`docs/backend/state-machines.md`; this document only covers what the client
surfaces and never redefines backend transitions.

Transition triggers are labeled: **user** (interaction), **system** (client
logic/timers), **backend** (response to a request).

---

## Session / Auth gate

**UI states:** `initializing` -> `signed-out` | `signed-in`

| From | Event | To | Trigger |
|------|-------|----|---------|
| initializing | store rehydrated + auth resolved, no token | signed-out | system |
| initializing | store rehydrated + auth resolved, token present | signed-in | system |
| signed-out | login/signup succeeds | signed-in | backend |
| signed-in | logout | signed-out | user |
| signed-in | session restore fails | signed-out | backend |

**Illegal / not exposed:** presenting app routes before `initializing`
completes; remaining on an auth screen while signed-in (redirected away).

---

## Login / Sign Up submission

**UI states:** `idle` -> `submitting` -> (`success` | `error`)

| From | Event | To | Trigger |
|------|-------|----|---------|
| idle | submit | submitting | user |
| submitting | credentials/registration accepted | success | backend |
| submitting | rejected | error | backend |
| error | edit + resubmit | submitting | user |

- `success` transitions the session (see Auth gate).
- `submitting` disables the submit control; no concurrent resubmit.

---

## Order actions (rider perspective)

The client only offers the action(s) valid for the order's current status. The
set of legal status transitions is defined in
`docs/backend/state-machines.md`.

**Surfaced action availability by status:**

| Order status | Actions offered | Resulting status (backend-owned) |
|--------------|-----------------|----------------------------------|
| assigned (New) | Accept, Decline | accepted / removed from rider |
| accepted | Mark Picked Up | picked_up |
| picked_up | Mark Delivered | delivered |
| delivered | none | terminal |
| cancelled | none | terminal |

**Per-action UI flow:**

| Action | UI states | Trigger of confirm |
|--------|-----------|--------------------|
| Accept | confirm dialog -> `actionLoading` -> updated | user confirms |
| Decline | reveal reason field -> submit -> removed from list, screen closes | user |
| Mark Picked Up | confirm dialog -> `actionLoading` -> updated | user confirms |
| Mark Delivered | navigate to Confirm Delivery | user |

**Illegal / not exposed:** acting on a status whose action is not offered;
issuing a second action while `actionLoading` (controls disabled).

**Notes:**
- Accept/Pickup update the current order in place on success.
- Decline removes the order from the rider's local list and closes the detail
  screen.
- If a backend action fails, the order remains in its prior UI state and an error
  is surfaced (see `failure-ux.md`).

---

## Confirm Delivery flow

**UI states:** `editing` -> (`uploading` ->) `submitting` -> (`success` | `error`)

| From | Event | To | Trigger |
|------|-------|----|---------|
| editing | confirm, photo attached | uploading | user |
| editing | confirm, no photo | submitting | user |
| uploading | photo upload resolves | submitting | backend |
| submitting | delivery accepted | success | backend |
| uploading/submitting | request fails | error | backend |
| error | retry confirm | uploading/submitting | user |

**Gating (UI enablement):**
- For COD orders, the confirm control is disabled until the cash checkbox is
  checked (a `blocked` sub-state of `editing`).
- While `uploading` or `submitting`, the confirm control is disabled.

**On success:** an acknowledgement dialog is shown, then navigation replaces to
the Orders tab.

**Illegal / not exposed:** confirming a COD order without the cash checkbox;
double submission while busy.

---

## Notification read state

**UI states per item:** `unread` -> `read`

| From | Event | To | Trigger |
|------|-------|----|---------|
| unread | tap item | read | user |
| unread | "Mark all read" | read | user |

- Read state is updated optimistically in the list after the request is issued.
- The Alerts tab badge reflects unread count and is refreshed on an interval by
  the tab bar (system) and on screen load/refresh (user).

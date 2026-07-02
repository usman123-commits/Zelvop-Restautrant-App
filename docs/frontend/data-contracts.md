# Frontend Data Contracts

Lists the backend-provided data the client consumes, per screen, and what the
client derives or persists. Field definitions, required/optional semantics at
the domain level, and lifecycles are owned by `docs/backend/entities.md`. This
document records only what the frontend reads and how it treats that data.

"Required" below means **required by the UI to render its normal state**;
"optional" means the UI renders without it.

---

## Entities consumed

- **User** (authenticated rider) — from auth responses and session restore.
- **Order** — rider order lists and single-order detail.
- **Notification** — rider notification list and unread count.

The client does not consume owner entities.

---

## User

| Field | Used by | Required/optional | Read/write |
|-------|---------|-------------------|-----------|
| `_id` | session | required | read-only |
| `name` | Home, Profile | required | user-initiated write (Profile edit) |
| `email` | Profile | required | user-initiated write (Profile edit) |
| `contactNumber` | Profile | optional | user-initiated write (Profile edit) |
| `role` | (session) | required | read-only |
| `isOnline` | Home, Profile | optional | user-initiated write (availability toggle) |
| `createdAt` | Profile ("Member since") | optional | read-only |

Writes are user-initiated only (Profile edit, availability toggle). No
client-side mutation of `role`.

---

## Order

Consumed as a list (Orders, Home) and as a single record (Order Detail).

| Field | Used by | Required/optional | Read/write |
|-------|---------|-------------------|-----------|
| `_id` | all order views | required | read-only |
| `orderId` | all order views | required | read-only |
| `status` | all order views (filters, timeline, actions) | required | read-only* |
| `customerName` | cards, detail | required | read-only |
| `customerPhone` | detail (Call/WhatsApp) | optional | read-only |
| `deliveryAddress` | cards, detail (Maps) | required | read-only |
| `deliveryNotes` | detail | optional | read-only |
| `items` (name, quantity, price) | detail, item count | required | read-only |
| `totalAmount` | cards, detail, confirm | required | read-only |
| `paymentMethod` | cards, detail, confirm (COD gating) | required | read-only |
| `assignedAt` | cards ("time ago") | optional | read-only |
| `createdAt` | cards ("time ago" fallback) | optional | read-only |
| `deliveredAt` | Home recent (sort/time) | optional | read-only |

\* `status` is read-only to the client. Status changes are performed through
order actions whose results the backend returns; legal transitions are defined
in `docs/backend/state-machines.md`.

**User-initiated writes on an order** (payloads sent, not fields the client
owns): decline reason; delivery proof photo URL, delivery notes, and
cash-collected acknowledgement (Confirm Delivery).

---

## Notification

| Field | Used by | Required/optional | Read/write |
|-------|---------|-------------------|-----------|
| `_id` | list, mark-read | required | read-only |
| `type` | icon selection | required | read-only |
| `title` | list | required | read-only |
| `body` | list | optional | read-only |
| `read` | unread indicator, badge | required | user-initiated write (mark read) |
| `createdAt` | "time ago" | required | read-only |
| `orderId` | tap-through to Order Detail | optional | read-only |
| `unreadCount` (list response) | Home + tab badge | required | read-only |

---

## Client-side derived data

Derived in the UI from the above; not stored on the backend:

- **Active orders / active delivery:** filtered from the order list by status.
- **Recent deliveries:** delivered orders sorted by delivery time.
- **Order filters (Active/New/Completed/All):** applied client-side over fetched
  orders.
- **Timeline step:** mapped from `status` for the Order Detail timeline.
- **"Time ago" strings:** computed from timestamps.
- **Initials / greeting:** derived from `name` and local time.
- **Unread count (list-derived):** count of unread items on the Notifications
  screen (in addition to the backend-provided `unreadCount`).

Derived values are display-only and are never written back.

---

## Caching / persistence expectations

- **Session persistence:** the auth token and user object are persisted to device
  storage and rehydrated on cold start. On restore, the user record is
  refreshed; a failed refresh ends the session.
- **Orders:** held in memory only for the session; not persisted to device
  storage. Reloaded on screen focus/refresh.
- **Notifications:** fetched on demand; not persisted. The tab badge count is
  polled on an interval while the app is open.
- No offline cache or write queue exists; see `failure-ux.md`.

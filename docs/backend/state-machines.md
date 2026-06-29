# State Machines

## Order Status

### States

| State | Description | Entry Condition |
|-------|-------------|-----------------|
| `pending_assignment` | Order created, no rider assigned yet. Waiting for auto-assignment or manual assignment. | Order creation, or rider declines/times out and no next rider available. |
| `assigned` | Rider has been assigned. Waiting for rider to accept or decline. 3-minute timer running. | Auto-assignment engine or owner manual assignment. |
| `accepted` | Rider accepted the order. Rider is expected to go to restaurant and pick up food. | Rider taps "Accept". |
| `picked_up` | Rider collected the food from restaurant. Rider is heading to customer. | Rider taps "Picked Up". |
| `delivered` | Rider confirmed delivery to customer. Terminal state. | Rider taps "Mark Delivered" and confirms. |
| `cancelled` | Order was cancelled. Terminal state. | Owner or rider cancels (before pickup only). |

### Legal Transitions

| From | To | Triggered By | Conditions |
|------|----|-------------|------------|
| `pending_assignment` | `assigned` | Assignment engine or owner | Eligible rider found or owner manually assigns. |
| `pending_assignment` | `cancelled` | Owner | Owner cancels unassigned order. |
| `assigned` | `accepted` | Rider | Rider taps Accept within timeout window. |
| `assigned` | `pending_assignment` | Rider or system | Rider declines, or 3-min timeout expires. If another eligible rider exists, transitions through `pending_assignment` to `assigned` immediately. |
| `assigned` | `cancelled` | Owner | Owner cancels before rider accepts. |
| `assigned` | `assigned` | Owner | Owner reassigns to a different rider (same state, different `assignedRiderId`). |
| `accepted` | `picked_up` | Rider | Rider taps "Picked Up" at restaurant. |
| `accepted` | `cancelled` | Owner or rider | Owner cancels, or rider cancels with required reason. |
| `accepted` | `assigned` | Owner | Owner reassigns to a different rider. Previous rider notified. |
| `picked_up` | `delivered` | Rider | Rider confirms delivery (with optional proof photo). |

### Illegal Transitions (explicitly blocked)

| From | To | Why |
|------|----|-----|
| `picked_up` | `cancelled` | Food is with rider. Cannot cancel after pickup. |
| `picked_up` | `assigned` | Cannot reassign after pickup. |
| `picked_up` | `pending_assignment` | Cannot unassign after pickup. |
| `delivered` | any | Terminal state. No outgoing transitions. |
| `cancelled` | any | Terminal state. No outgoing transitions. |
| `pending_assignment` | `accepted` | Must go through `assigned` first. |
| `pending_assignment` | `picked_up` | Must go through `assigned` and `accepted` first. |
| `pending_assignment` | `delivered` | Must go through full lifecycle. |
| any | `pending_assignment` | Only via decline/timeout from `assigned`, never from other states. |

### Enforcement

| Rule | Enforced At |
|------|-------------|
| Valid transition check | Backend: order service, before any status update. |
| Only assigned rider can accept/decline | Backend: middleware checks `order.assignedRiderId === req.user._id`. |
| Only assigned rider can mark pickup/delivery | Backend: middleware checks `order.assignedRiderId === req.user._id`. |
| Only owner can reassign | Backend: middleware checks `req.user.role === 'owner'`. |
| Cancel blocked after pickup | Backend: order service rejects cancel when status is `picked_up` or terminal. |
| Timeout enforcement | Backend: scheduled job (cron or setTimeout) checks `acceptTimeoutAt < now` for `assigned` orders. |
| Rider cancel requires reason | Backend: validation middleware requires `reason` field for rider cancellation. |

---

## Order Accept Timeout

### States

| State | Description |
|-------|-------------|
| `waiting` | Timer running. Rider has not responded. `acceptTimeoutAt` is in the future. |
| `accepted` | Rider accepted. Timer cancelled (no longer relevant). |
| `expired` | `acceptTimeoutAt` has passed. Rider did not respond. |

### Transitions

| From | To | Trigger |
|------|----|---------|
| `waiting` | `accepted` | Rider accepts within 3 minutes. |
| `waiting` | `expired` | 3 minutes pass with no response. |
| `expired` | (triggers) | Assignment engine auto-declines and re-assigns to next eligible rider. |

### Enforcement

- `acceptTimeoutAt` is set server-side as `assignedAt + 3 minutes`.
- A scheduled check (cron every 30 seconds, or per-order setTimeout) finds orders where `status === 'assigned' AND acceptTimeoutAt < now`.
- On expiry: create AssignmentLog entry with `action: timeout`, then trigger re-assignment.

---

## Stale Accepted Warning

Not a state machine on the order. A monitoring rule.

| Condition | Action |
|-----------|--------|
| Order has `status === 'accepted'` AND `acceptedAt + 20 minutes < now` | Create notification for owner: "Rider [name] accepted Order #[id] 20 minutes ago but hasn't picked up yet." |
| Order moves to `picked_up` | Warning becomes irrelevant. No action needed. |
| Owner reassigns the order | Warning becomes irrelevant. No action needed. |

### Enforcement

- Scheduled check (cron every 1 minute) scans for stale accepted orders.
- Notification is created once per order per stale event (use a flag or check existing notifications to avoid duplicates).

---

## Rider Online Status

### States

| State | `isOnline` Value | Description |
|-------|------------------|-------------|
| `offline` | `false` | Rider is not available for assignment. Default state. |
| `online` | `true` | Rider is available for assignment. |

### Transitions

| From | To | Trigger |
|------|----|---------|
| `offline` | `online` | Rider toggles switch in app. Sets `lastOnlineAt`. |
| `online` | `offline` | Rider toggles switch in app. |
| `online` | `offline` | App detects prolonged inactivity (future, not in v1). |

### Enforcement

- Toggle is a simple PATCH to `/api/v1/riders/me/status`.
- Assignment engine queries `isOnline === true` when selecting eligible riders.
- Being online does not guarantee assignment. Rider must also have no active order.
- `isOnline` is persisted in DB, not in-memory. Survives server restarts.

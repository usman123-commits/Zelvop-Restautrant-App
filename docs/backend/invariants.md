# Invariants

Rules that must never break. Violation of any invariant is a bug.

---

## I1: Order Status Progression

**Rule:** Order status can only follow transitions defined in state-machines.md. No skipping states, no backward transitions except `assigned -> pending_assignment` (on decline/timeout).

**Enforced by:** Backend order service. A transition map is checked before every status update. Invalid transitions return 400.

---

## I2: Single Active Order Per Rider

**Rule:** A rider can have at most one order in a non-terminal active state (`assigned`, `accepted`, or `picked_up`) at any time.

**Enforced by:** Backend assignment engine. Before assigning, query: `Order.findOne({ assignedRiderId, status: { $in: ['assigned', 'accepted', 'picked_up'] } })`. If found, rider is ineligible.

**Why:** A rider carrying two deliveries simultaneously degrades service. The assignment engine must respect this.

---

## I3: Only Assigned Rider Can Act

**Rule:** Only the rider whose `_id` matches `order.assignedRiderId` can accept, decline, mark pickup, or mark delivery for that order.

**Enforced by:** Backend middleware on all rider status-transition endpoints. Compares `req.user._id` with `order.assignedRiderId`. Mismatch returns 403.

---

## I4: No Cancellation After Pickup

**Rule:** Once an order reaches `picked_up` status, it cannot be cancelled by anyone (owner or rider).

**Enforced by:** Backend order service. Cancel handler checks `status !== 'picked_up' && status !== 'delivered'`. Violation returns 400.

**Why:** Food is physically with the rider. Cancellation at this point creates an unrecoverable logistics problem.

---

## I5: Terminal States Are Irreversible

**Rule:** Orders in `delivered` or `cancelled` status cannot transition to any other state.

**Enforced by:** Backend order service. Transition map has no outgoing edges from terminal states. Any attempt returns 400.

---

## I6: Rider Cancel Requires Reason

**Rule:** When a rider cancels an accepted order, a non-empty `reason` string is required.

**Enforced by:** Backend validation middleware on the cancel endpoint. If `req.user.role === 'rider'` and `reason` is empty or missing, return 400.

**Why:** Owner needs to know why the rider backed out (e.g. bike broke down, emergency).

---

## I7: Accept Timeout Is Server-Authoritative

**Rule:** `acceptTimeoutAt` is computed and set by the server (`assignedAt + 3 minutes`). Clients cannot set or modify it.

**Enforced by:** Backend assignment logic. Field is never accepted from request body. Timeout check compares server clock to `acceptTimeoutAt`.

---

## I8: Assignment Only To Online, Free Riders

**Rule:** Auto-assignment engine can only assign orders to riders where `isOnline === true` AND the rider has no active order (per I2).

**Enforced by:** Backend assignment engine query. Manual owner assignment bypasses the `isOnline` check (owner may know the rider is available by phone) but still respects I2.

**Exception:** Owner manual assignment can assign to an offline rider. This is intentional -- owner may have called the rider.

---

## I9: OrderId Is Immutable and Unique

**Rule:** `orderId` (human-readable, e.g. `ORD-0042`) is generated server-side at creation and never changes.

**Enforced by:** Database unique index on `orderId`. Field is excluded from all update operations.

---

## I10: Payment Confirmation Required for COD

**Rule:** When `paymentMethod === 'cod'`, the delivery confirmation must include `cashCollected: true`.

**Enforced by:** Backend order service. On the `picked_up -> delivered` transition, if `paymentMethod === 'cod'` and `cashCollected !== true`, return 400.

**Why:** Owner needs confirmation that cash was collected before marking the order as complete.

---

## I11: Proof Photo Is Optional But Tracked

**Rule:** `proofPhotoUrl` is not required for delivery confirmation, but if provided, it must be a valid Cloudinary URL.

**Enforced by:** Backend validation. URL format check if field is present. No rejection if absent.

---

## I12: AssignmentLog Is Append-Only

**Rule:** AssignmentLog entries are never updated or deleted. They are an immutable audit trail.

**Enforced by:** No update or delete endpoints exist for AssignmentLog. No update or delete operations in the service layer.

---

## I13: Reassignment Resets Timer

**Rule:** When an order is reassigned (by owner or by auto-reassignment after decline/timeout), `assignedAt` and `acceptTimeoutAt` are reset for the new rider. `acceptedAt` is cleared.

**Enforced by:** Backend assignment logic. On reassignment: set `assignedRiderId` to new rider, set `assignedAt` to now, set `acceptTimeoutAt` to now + 3 min, clear `acceptedAt`.

---

## I14: Timestamps Are Server-Set

**Rule:** All lifecycle timestamps (`assignedAt`, `acceptedAt`, `pickedUpAt`, `deliveredAt`, `cancelledAt`) are set by the server at transition time. Clients cannot provide or override them.

**Enforced by:** Backend strips these fields from request bodies. Values are set in the service layer using `new Date()`.

---

## I15: Role Immutability

**Rule:** A user's `role` cannot change after account creation. A rider cannot become an owner and vice versa.

**Enforced by:** Backend user service. Role field is excluded from all update operations.

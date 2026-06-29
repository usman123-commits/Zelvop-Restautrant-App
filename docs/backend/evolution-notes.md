# Evolution Notes

How future features can be added safely, and what must not change.

---

## Things That Must NOT Change

| Item | Why |
|------|-----|
| Order status enum values (`pending_assignment`, `assigned`, `accepted`, `picked_up`, `delivered`, `cancelled`) | Persisted in DB. Changing values breaks all existing orders. Add new states, never rename or remove. |
| `orderId` format (`ORD-XXXX`) | Used in customer communications (WhatsApp), printed receipts, owner dashboard. Changing format breaks references. |
| AssignmentLog schema | Append-only audit trail. Existing entries must remain readable. Add new fields, never remove or rename. |
| `paymentMethod` enum values (`cod`, `prepaid`) | Persisted in DB. Add new values, never rename or remove. |
| Role enum values (`owner`, `rider`) | Persisted in DB and used in auth middleware. Add new roles, never rename or remove. |
| Terminal state rule (delivered/cancelled are irreversible) | Business logic and audit trail depend on this. Reversing a delivery creates accounting problems. |
| I2: single active order per rider | Assignment engine, offline queue, and UI all depend on this. Removing it requires changes across the entire stack. |

---

## Safe Extension Points

### Adding New Order States

**Example:** Adding `ready_for_pickup` between `accepted` and `picked_up` (restaurant marks food as ready).

**How to add safely:**
1. Add new enum value to Order model. Existing orders are unaffected (they don't have this state).
2. Add new transitions to the transition map in order service.
3. Update frontend state machine display.
4. Existing orders in `accepted` or `picked_up` continue working. No migration needed.

**Rule:** New states must be inserted between existing states. Never replace an existing state.

---

### Adding Rider Earnings

**Example:** Track per-delivery earnings and daily/weekly totals.

**How to add safely:**
1. Create new `Earnings` model: `{ riderId, orderId, amount, type: 'delivery_fee' | 'tip' | 'bonus', createdAt }`.
2. On `delivered` transition, create an Earnings entry.
3. Add `GET /api/v1/riders/me/earnings` endpoint.
4. No changes to Order model. Earnings are a separate concern.

**Rule:** Do not add earnings fields to the Order model. Keep it as a separate entity.

---

### Adding GPS Tracking

**Example:** Real-time rider location for customer tracking or location-based assignment.

**How to add safely:**
1. Create new `RiderLocation` model: `{ riderId, lat, lng, accuracy, timestamp }`. TTL index to auto-delete old locations.
2. Rider app sends location updates periodically (every 30s when active delivery exists).
3. Assignment engine optionally uses location for nearest-rider selection.
4. No changes to Order model or User model. Location is ephemeral data.

**Rule:** Location data is ephemeral and privacy-sensitive. TTL of 24 hours max. Never store location history permanently.

---

### Adding Multiple Restaurants

**Example:** Zelvop serves multiple restaurant owners, each with their own riders and orders.

**How to add safely:**
1. Add `restaurantId` to User model (which restaurant the owner/rider belongs to).
2. Add `restaurantId` to Order model.
3. Add `Restaurant` model: `{ name, address, ownerId }`.
4. All queries filter by `restaurantId`. Riders only see their restaurant's orders.
5. Assignment engine scopes to same `restaurantId`.

**Impact:** This is a significant change. Requires adding `restaurantId` to every query. Plan this before it's needed, not after.

**Rule:** If multi-restaurant is likely within 6 months, add `restaurantId` to Order and User models now (default to a single hardcoded value). Cheaper to add an unused field now than to migrate later.

---

### Adding Customer Tracking Link

**Example:** Customer gets a WhatsApp message with a link to track their delivery in real-time.

**How to add safely:**
1. Generate a unique `trackingToken` (UUID) on order creation. Add to Order model.
2. Create a public (no auth) endpoint: `GET /api/v1/track/:trackingToken`.
3. Returns: order status, rider name (first name only), estimated delivery time.
4. Does NOT return: rider phone, exact location, customer address, order items.
5. Token expires after delivery (or 24 hours, whichever is first).

**Rule:** Tracking endpoint is public. Never expose sensitive data. Minimal information only.

---

### Adding Order Rating

**Example:** Customer rates the delivery after completion.

**How to add safely:**
1. Create `Rating` model: `{ orderId, riderId, score: 1-5, comment, createdAt }`.
2. Rating link sent to customer via WhatsApp after delivery.
3. Public endpoint (authenticated by order tracking token, not user auth).
4. Rider sees average rating on profile. No individual ratings shown.

**Rule:** Ratings are a separate entity. Do not add rating fields to Order model.

---

### Adding Scheduled Orders

**Example:** Customer orders food for delivery at a specific future time.

**How to add safely:**
1. Add `scheduledFor: Date` (nullable) to Order model.
2. If `scheduledFor` is set, order stays in `pending_assignment` until `scheduledFor - 30 minutes`.
3. Assignment engine ignores scheduled orders until trigger time.
4. Existing orders have `scheduledFor: null` and work exactly as before.

**Rule:** Scheduled orders use the same status machine. The only difference is when assignment is triggered.

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why It Breaks Things |
|--------------|---------------------|
| Storing derived data on Order (e.g., `riderName` alongside `assignedRiderId`) | Denormalization creates stale data when rider updates their name. Always join from User. |
| Using order status for business logic beyond lifecycle (e.g., `status: 'payment_pending'`) | Status machine is for delivery lifecycle only. Payment state belongs on a separate entity or field. |
| Adding order modification after creation (e.g., customer changes items mid-delivery) | Violates order immutability. Creates reconciliation problems with payment. Handle as cancellation + new order. |
| Sharing the accept timeout between reassignments (e.g., "3 min total, not per rider") | Each rider deserves their own full accept window. Timer must reset on reassignment (I13). |
| Making `isOnline` automatic (e.g., "go offline when app backgrounds") | Rider may background the app to use Google Maps. Auto-offline would drop them from assignment pool mid-delivery. Manual toggle only. |

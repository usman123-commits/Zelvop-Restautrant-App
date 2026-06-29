# Entities

## User

| Field | Type | Required | Mutable | Notes |
|-------|------|----------|---------|-------|
| `_id` | ObjectId | auto | no | |
| `name` | String | yes | yes | |
| `email` | String | yes | no | Unique. Lowercase. Used for login. |
| `password` | String | yes | yes | Hashed (bcrypt). Never returned in API responses. |
| `role` | Enum | yes | no | `owner` or `rider`. Set at signup, immutable. |
| `contactNumber` | String | no | yes | 10-digit phone number when provided. |
| `profilePhoto` | String | no | yes | Cloudinary URL. |
| `isOnline` | Boolean | no | yes | Rider only. Default `false`. Controls assignment eligibility. |
| `lastOnlineAt` | Date | no | yes | Updated when `isOnline` transitions to `true`. |
| `createdAt` | Date | auto | no | |
| `updatedAt` | Date | auto | yes | |

**Ownership:** Auth service controls creation. User service controls profile updates. Assignment engine reads `isOnline`.

**Relationships:**
- A rider can be assigned to zero or many orders (one active at a time).
- An owner can create zero or many orders.

**Constraints:**
- `email` has a unique index.
- `role` is immutable after creation.
- `isOnline` is only meaningful for `rider` role. Ignored for `owner`.
- Owner accounts do not use the mobile app. They use the web dashboard.

---

## Order

| Field | Type | Required | Mutable | Notes |
|-------|------|----------|---------|-------|
| `_id` | ObjectId | auto | no | |
| `orderId` | String | auto | no | Human-readable. Format: `ORD-XXXX` (zero-padded sequential). Unique index. |
| `customerName` | String | yes | no | From WhatsApp bot or manual entry. |
| `customerPhone` | String | yes | no | WhatsApp number. Format: country code + number. |
| `deliveryAddress` | String | yes | no | Full text address. |
| `deliveryNotes` | String | no | no | Customer's delivery instructions (e.g. "ring bell twice"). |
| `items` | Array | yes | no | `[{ name: String, quantity: Number, price: Number }]`. At least one item required. |
| `totalAmount` | Number | yes | no | Sum of `item.price * item.quantity`. Computed at creation, stored. |
| `paymentMethod` | Enum | yes | no | `cod` or `prepaid`. |
| `status` | Enum | yes | yes | See state-machines.md. Default: `pending_assignment`. |
| `source` | Enum | yes | no | `whatsapp` or `dashboard`. How the order was created. |
| `createdBy` | ObjectId | no | no | Ref: User. The owner who created it (null if from WhatsApp bot). |
| `assignedRiderId` | ObjectId | no | yes | Ref: User. The currently assigned rider. Null when unassigned. |
| `assignedAt` | Date | no | yes | When the current rider was assigned. Reset on reassignment. |
| `acceptTimeoutAt` | Date | no | yes | `assignedAt + 3 minutes`. Null when unassigned. |
| `acceptedAt` | Date | no | yes | When rider accepted. Null until accepted. |
| `pickedUpAt` | Date | no | yes | When rider marked pickup. Null until picked up. |
| `deliveredAt` | Date | no | yes | When rider confirmed delivery. Null until delivered. |
| `cancelledAt` | Date | no | yes | When order was cancelled. Null unless cancelled. |
| `cancelledBy` | Enum | no | yes | `owner` or `rider`. Null unless cancelled. |
| `cancelReason` | String | no | yes | Required when rider cancels. Optional when owner cancels. |
| `declineReason` | String | no | yes | Last decline reason (from the rider who declined). |
| `proofPhotoUrl` | String | no | yes | Cloudinary URL. Set at delivery confirmation. |
| `riderDeliveryNotes` | String | no | yes | Rider's notes at delivery (e.g. "left at gate"). |
| `cashCollected` | Boolean | no | yes | For COD orders. Rider confirms cash was collected. |
| `createdAt` | Date | auto | no | |
| `updatedAt` | Date | auto | yes | |

**Ownership:** Order creation is owned by the WhatsApp bot integration or the owner via dashboard API. Status transitions are owned by the rider (accept, pickup, deliver) or the assignment engine (assign, timeout, reassign). Cancellation is owned by the owner or rider depending on `cancelledBy`.

**Relationships:**
- An order belongs to zero or one rider (`assignedRiderId`).
- An order has zero or many assignment log entries.
- An order has zero or many notifications.

**Constraints:**
- `orderId` has a unique index. Generated server-side, never client-provided.
- `items` array must have at least one element.
- `totalAmount` must equal the sum of `items[].price * items[].quantity`.
- `paymentMethod` is immutable after creation.
- `assignedRiderId` can only reference a user with `role: rider`.
- `proofPhotoUrl` can only be set during the `picked_up -> delivered` transition.
- `cashCollected` is only relevant when `paymentMethod: cod`.
- Timestamp fields (`acceptedAt`, `pickedUpAt`, etc.) are set server-side, never client-provided.

---

## AssignmentLog

| Field | Type | Required | Mutable | Notes |
|-------|------|----------|---------|-------|
| `_id` | ObjectId | auto | no | |
| `orderId` | ObjectId | yes | no | Ref: Order. |
| `riderId` | ObjectId | yes | no | Ref: User. The rider involved in this action. |
| `action` | Enum | yes | no | `assigned`, `accepted`, `declined`, `timeout`, `reassigned_away`, `cancelled`. |
| `reason` | String | no | no | Decline or cancel reason. |
| `performedBy` | ObjectId | no | no | Ref: User. The user who triggered this (owner for reassign, rider for accept/decline). |
| `createdAt` | Date | auto | no | |

**Ownership:** Created by the assignment engine or order status transition handlers. Append-only.

**Relationships:**
- Belongs to one order.
- References one rider.

**Constraints:**
- Entirely immutable after creation (append-only audit log).
- No updates or deletes permitted.
- Used for debugging and acceptance rate calculation.

---

## Notification

| Field | Type | Required | Mutable | Notes |
|-------|------|----------|---------|-------|
| `_id` | ObjectId | auto | no | |
| `userId` | ObjectId | yes | no | Ref: User. The recipient. |
| `type` | Enum | yes | no | `new_order`, `order_cancelled`, `order_reassigned`, `stale_warning`, `timeout_decline`. |
| `title` | String | yes | no | Notification heading. |
| `body` | String | yes | no | Notification detail text. |
| `orderId` | ObjectId | no | no | Ref: Order. Null for system notifications. |
| `read` | Boolean | yes | yes | Default `false`. Only mutable field. |
| `createdAt` | Date | auto | no | |

**Ownership:** Created by the notification service (triggered by status transitions, assignment events, and stale checks). Read-status toggled by the recipient user.

**Relationships:**
- Belongs to one user.
- Optionally references one order.

**Constraints:**
- `read` is the only mutable field. All other fields are immutable after creation.
- Notifications are never deleted (soft-read, no hard delete).
- Push notification delivery is best-effort. In-app notification list is the source of truth.

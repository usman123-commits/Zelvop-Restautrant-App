# Data Flow

Who creates, reads, updates, and is forbidden from touching each piece of data.

---

## Order

| Operation | Actor | Path | Notes |
|-----------|-------|------|-------|
| **Create** | WhatsApp bot (via API) | `POST /api/v1/owner/orders` | Bot authenticates as owner or uses an API key. |
| **Create** | Owner (via dashboard) | `POST /api/v1/owner/orders` | Manual order entry. |
| **Read (own)** | Rider | `GET /api/v1/orders` | Filtered to `assignedRiderId === rider._id`. Includes all statuses. |
| **Read (all)** | Owner | `GET /api/v1/owner/orders` | All orders, all statuses. Dashboard use. |
| **Read (single)** | Rider | `GET /api/v1/orders/:id` | Only if assigned to this rider (current or past via AssignmentLog). |
| **Read (single)** | Owner | `GET /api/v1/owner/orders/:id` | Any order. |
| **Update status** | Rider | `PATCH /api/v1/orders/:id/{accept,decline,pickup,deliver}` | Only the currently assigned rider. |
| **Update status** | System (timeout) | Internal cron | Auto-decline on timeout. No API call. |
| **Assign/reassign** | Assignment engine | Internal | On order creation or decline/timeout. |
| **Assign/reassign** | Owner | `PATCH /api/v1/owner/orders/:id/assign` | Manual override. |
| **Cancel** | Owner | `PATCH /api/v1/owner/orders/:id/cancel` | Before pickup only. |
| **Cancel** | Rider | `PATCH /api/v1/orders/:id/cancel` | Before pickup only. Reason required. |

### Forbidden Write Paths

| Actor | Operation | Why |
|-------|-----------|-----|
| Rider | Create order | Riders do not create orders. Orders come from WhatsApp or owner. |
| Rider | Assign/reassign | Riders cannot choose which orders they get. |
| Rider | Modify order content (items, address, amount) | Order content is immutable after creation. |
| Rider | Cancel after pickup | I4: No cancellation after pickup. |
| Owner | Accept/decline on behalf of rider | Owner can reassign, but cannot accept for a rider. |
| Owner | Mark pickup/delivery | Only the physically present rider does this. |
| Anyone | Modify `orderId` | I9: Immutable. |
| Anyone | Modify lifecycle timestamps | I14: Server-set only. |

---

## User

| Operation | Actor | Path | Notes |
|-----------|-------|------|-------|
| **Create** | Self (signup) | `POST /api/v1/auth/signup` | Role set at signup, immutable. |
| **Read (self)** | Any authenticated user | `GET /api/v1/auth/me` | Own profile only. |
| **Read (riders list)** | Owner | `GET /api/v1/owner/riders` | Owner sees all riders and their online status. |
| **Update (profile)** | Self | `PATCH /api/v1/auth/me` | Name, contactNumber, profilePhoto. |
| **Update (password)** | Self | `POST /api/v1/auth/reset-password` | Via reset token. |
| **Update (isOnline)** | Rider (self) | `PATCH /api/v1/riders/me/status` | Toggle online/offline. |

### Forbidden Write Paths

| Actor | Operation | Why |
|-------|-----------|-----|
| Anyone | Change role | I15: Role is immutable. |
| Rider | Read other riders' data | Rider sees only their own profile. |
| Owner | Toggle rider's online status | Only the rider controls their own availability. |

---

## AssignmentLog

| Operation | Actor | Path | Notes |
|-----------|-------|------|-------|
| **Create** | System | Internal (service layer) | Created automatically on assign, accept, decline, timeout, reassign, cancel. |
| **Read** | Owner | `GET /api/v1/owner/orders/:id/history` | Audit trail for an order. |
| **Read** | Rider | Not exposed | Rider does not see assignment history. |

### Forbidden Write Paths

| Actor | Operation | Why |
|-------|-----------|-----|
| Anyone | Update or delete | I12: Append-only. |

---

## Notification

| Operation | Actor | Path | Notes |
|-----------|-------|------|-------|
| **Create** | System | Internal (service layer) | Created on status transitions, assignment events, stale warnings. |
| **Read** | Recipient user | `GET /api/v1/notifications` | Own notifications only. |
| **Update (read)** | Recipient user | `PATCH /api/v1/notifications/:id/read` | Mark as read. Only mutable field. |

### Forbidden Write Paths

| Actor | Operation | Why |
|-------|-----------|-----|
| Anyone | Delete notification | Notifications are soft-read, never deleted. |
| Anyone | Modify title/body/type | Immutable after creation. |
| User A | Read User B's notifications | Filtered by `userId === req.user._id`. |

---

## Data Flow Diagram (Order Lifecycle)

```
WhatsApp Bot / Owner Dashboard
        |
        v
  POST /api/v1/owner/orders  (creates order, status = pending_assignment)
        |
        v
  Assignment Engine  (finds eligible rider: online + free + lowest load)
        |
        v
  Order.assignedRiderId = rider._id  (status = assigned, timeout timer starts)
        |
        v
  Push Notification -> Rider App
        |
        +---> Rider accepts  -> status = accepted  -> Rider picks up -> status = picked_up
        |                                                                      |
        |                                                                      v
        |                                                              Rider delivers
        |                                                              status = delivered
        |                                                              (proof photo, cash confirm)
        |
        +---> Rider declines  -> AssignmentLog entry -> Re-run assignment engine
        |                                                  |
        |                                                  +---> Next rider found -> assigned
        |                                                  +---> No rider found -> pending_assignment
        |                                                                           (owner notified)
        |
        +---> 3 min timeout  -> Auto-decline -> Same as decline flow above
```

---

## Integration Points

| External System | Direction | Data | Mechanism |
|-----------------|-----------|------|-----------|
| WhatsApp Bot (n8n) | Bot -> Backend | New order (customer, items, address, payment) | HTTP POST to owner orders endpoint |
| Web Dashboard | Dashboard <-> Backend | Orders CRUD, rider list, assignment | REST API |
| Expo Push | Backend -> Rider App | Notifications | Expo Push Notification service |
| Cloudinary | Rider App -> Cloudinary -> Backend | Delivery proof photos | Upload to Cloudinary, store URL in order |
| Google Maps | Rider App -> Google Maps | Navigation to delivery address | Deep link (open external app), no backend involvement |

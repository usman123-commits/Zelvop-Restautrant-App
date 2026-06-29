# Failure Modes

---

## 1. Offline Behavior

### Rider App Offline

| Action | Behavior | Rationale |
|--------|----------|-----------|
| View assigned orders | Works (cached locally via Redux Persist) | Read-only from cache. |
| View order detail | Works (cached) | Read-only from cache. |
| Accept order | Blocked. Show: "Network connection required to accept order." | Assignment is server-authoritative. Accepting offline could conflict with timeout or reassignment. |
| Decline order | Blocked. Show: "Network connection required to decline order." | Decline triggers reassignment logic server-side. Cannot be queued. |
| Mark picked up | Queued offline. Synced when online. | Pickup is a forward-only, non-conflicting transition. Safe to queue. |
| Mark delivered | Queued offline. Synced when online. | Delivery is a forward-only, non-conflicting transition. Safe to queue. |
| Upload proof photo | Queued offline (photo stored locally). Uploaded when online. | Idempotent via unique photo ID. |
| Toggle online/offline | Queued offline. Synced when online. | Last-write-wins. Acceptable lag. |
| View notifications | Works (cached). New notifications appear after sync. | Read-only from cache. |

### Why Accept/Decline Are NOT Queued Offline

Accepting offline is dangerous:
- The 3-minute timeout may have already expired server-side.
- The owner may have reassigned the order to another rider.
- The rider would see "accepted" locally but the server has moved on.
- On sync, the accept would be rejected (rider no longer assigned), creating confusion.

Declining offline is also dangerous:
- Decline triggers re-assignment server-side. Cannot happen without the server.
- If queued, the decline might arrive after the timeout already triggered the same re-assignment, causing duplicate log entries.

**Rule:** Any action that triggers server-side side effects (reassignment, timer cancellation) must be online-only.

### Backend Offline (server down)

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| Server unreachable | Rider app shows cached data. All write actions fail with network error. | Retry with exponential backoff for queued actions. |
| Database unreachable | All API calls return 500. | Backend health check endpoint. Owner restarts server. |
| Cloudinary unreachable | Photo uploads fail. | Photo queued locally. Retry on next sync. Delivery can proceed without photo. |
| Expo Push unreachable | Push notifications not delivered. | In-app notification list is the fallback. Rider checks app manually. |

---

## 2. Retry Safety

### Idempotent Operations (safe to retry)

| Operation | Idempotency Key | Behavior on Duplicate |
|-----------|-----------------|----------------------|
| Accept order | `orderId + riderId` | If already accepted by same rider, return 200 (no-op). If reassigned, return 403. |
| Mark picked up | `orderId` | If already `picked_up`, return 200 (no-op). |
| Mark delivered | `orderId` | If already `delivered`, return 200 (no-op). |
| Upload proof photo | `photoId` (UUID generated client-side) | If `photoId` already exists, return existing URL. No duplicate upload. |
| Toggle online status | `userId` | Last-write-wins. Inherently idempotent. |
| Mark notification read | `notificationId` | If already read, return 200 (no-op). |

### Non-Idempotent Operations (NOT safe to retry blindly)

| Operation | Risk on Duplicate | Mitigation |
|-----------|-------------------|------------|
| Create order | Duplicate order created. | Dedup key: `customerPhone + timestamp` within 60-second window. Backend rejects if duplicate found. |
| Decline order | Duplicate AssignmentLog entry. | Check if already declined by this rider for this order. Skip if exists. |
| Cancel order | Duplicate cancel attempt. | If already cancelled, return 200 (no-op). |

---

## 3. Duplication Handling

### Duplicate Order Creation

**Scenario:** WhatsApp bot sends the same order twice (webhook fires twice within seconds).

**Detection:** Backend checks for existing order with same `customerPhone` and `createdAt` within 60-second window.

**Response:** Return 409 Conflict with the existing order ID.

### Duplicate Assignment

**Scenario:** Assignment engine runs twice before the first assignment is persisted (race condition).

**Detection:** Before assigning, check `order.status`. If already `assigned`, skip.

**Response:** No-op. Log the duplicate attempt for debugging.

### Duplicate Accept

**Scenario:** Rider taps Accept twice quickly. Two API calls hit the server.

**Detection:** Second call finds `status === 'accepted'` and `assignedRiderId === rider._id`.

**Response:** Return 200 with current order state. No side effects.

### Duplicate Push Notification

**Scenario:** Expo Push delivers the same notification twice (common on Android).

**Detection:** Client-side. Notification list deduplicates by `notification._id`.

**Response:** UI shows one notification. No server action needed.

---

## 4. Partial Success Scenarios

### Delivery Confirmed but Photo Upload Fails

**Scenario:** Rider confirms delivery. Status transitions to `delivered`. Photo upload fails (network drops mid-upload).

**Behavior:**
- Order status = `delivered` (committed server-side).
- Photo remains in local queue.
- On next sync, photo uploads and `proofPhotoUrl` is updated on the order.
- If photo never uploads (e.g. rider clears app data), order is still delivered but without proof.

**Acceptable?** Yes. Photo is optional (I11). Delivery status is more important than the photo.

### Assignment Succeeds but Push Notification Fails

**Scenario:** Order assigned to rider. AssignmentLog created. Push notification fails to deliver.

**Behavior:**
- Order is assigned (DB state is correct).
- Rider does not see the notification.
- Rider will see the order on next app open or pull-to-refresh.
- 3-minute timeout still runs. If rider doesn't see it, timeout triggers and order is reassigned.

**Acceptable?** Yes. The timeout is the safety net for missed notifications.

### Timeout Fires but Reassignment Fails (No Riders Available)

**Scenario:** Rider doesn't accept in 3 minutes. Timeout fires. No other eligible riders (all offline or busy).

**Behavior:**
- Current rider is unassigned. AssignmentLog: `action: timeout`.
- Order status reverts to `pending_assignment`.
- Owner is notified: "No riders available for Order #[id]."
- Order sits in `pending_assignment` until a rider comes online or owner assigns manually.

**Acceptable?** Yes. This is the correct behavior. The order is not lost.

### Rider Accepts, Then Server Crashes Before Persisting

**Scenario:** Rider sends accept. Server receives it. Server crashes before writing to DB.

**Behavior:**
- Rider sees "accepted" optimistically in app (optimistic update).
- On next sync, rider fetches order. Status is still `assigned`.
- App reverts optimistic update. Rider sees order as "assigned" again.
- Rider can accept again.

**Acceptable?** Yes. Optimistic updates are always reverted on sync mismatch.

---

## 5. Conflict Scenarios

### Rider Accepts While Owner Reassigns

**Scenario:** Rider taps Accept at the same moment owner reassigns to a different rider.

**Resolution:** Server uses the order's current `assignedRiderId` at write time.
- If rider's accept arrives first: accept succeeds, owner's reassign operates on the accepted order.
- If owner's reassign arrives first: rider is no longer assigned, accept returns 403 ("Order was reassigned").

**Enforcement:** Backend uses atomic `findOneAndUpdate` with condition `{ _id: orderId, assignedRiderId: riderId, status: 'assigned' }`. If condition fails, the operation is rejected.

### Two Orders Created Simultaneously, One Rider Available

**Scenario:** Two WhatsApp orders arrive at the same second. Only one rider is online and free.

**Resolution:** Assignment engine processes orders sequentially (serialized by a queue or mutex).
- First order gets the rider.
- Second order: no eligible riders. Status = `pending_assignment`. Owner notified.

**Enforcement:** Assignment engine uses `findOneAndUpdate` with condition `{ isOnline: true, no active order }` to atomically claim a rider. Second attempt finds no match.

# Phase 1 Backend Test Log

**Date:** 2026-06-29
**Tested by:** Claude + manual curl
**Server:** localhost:5000
**Database:** MongoDB localhost:27017/Zelvop

---

## Test Accounts

| Role | Email | Password | User ID |
|------|-------|----------|---------|
| Owner | otto@test.com | test123 | 6a41d29f4264ee63f1ee328b |
| Rider | ahmed@test.com | test123 | 6a41d2a94264ee63f1ee328e |

---

## Test Results

### Auth

| # | Test | Endpoint | Expected | Result |
|---|------|----------|----------|--------|
| 1 | Signup owner | POST /auth/signup | 201 + token + user | PASS |
| 2 | Signup rider | POST /auth/signup | 201 + token + user | PASS |
| 3 | Login valid | POST /auth/login | 200 + token | PASS |
| 4 | Login wrong password | POST /auth/login | 401 Invalid credentials | PASS |
| 5 | Duplicate email signup | POST /auth/signup | 400 Email already registered | PASS |
| 6 | Get profile | GET /auth/me | 200 + user data | PASS |

### Order Lifecycle (Happy Path)

| # | Test | Endpoint | Expected | Result |
|---|------|----------|----------|--------|
| 7 | Owner creates order | POST /owner/orders | 201, status=pending_assignment, orderId=ORD-0001 | PASS |
| 8 | Total calculated correctly | POST /owner/orders | 2x450 + 1x350 + 2x100 = 1450 | PASS |
| 9 | Owner assigns to rider | PATCH /owner/orders/:id/assign | status=assigned, acceptTimeoutAt set (assignedAt + 3min) | PASS |
| 10 | Rider accepts | PATCH /orders/:id/accept | status=accepted, acceptedAt set | PASS |
| 11 | Rider marks pickup | PATCH /orders/:id/pickup | status=picked_up, pickedUpAt set | PASS |
| 12 | Rider delivers (COD + cash confirmed) | PATCH /orders/:id/deliver | status=delivered, cashCollected=true | PASS |

### Invariant Enforcement (Must Fail)

| # | Invariant | Test | Expected Error | Result |
|---|-----------|------|----------------|--------|
| 13 | I5: Terminal irreversible | Accept a delivered order | "Cannot accept order in 'delivered' status" | PASS |
| 14 | I10: COD cash required | Deliver COD without cashCollected | "Cash collection must be confirmed for COD orders" | PASS |
| 15 | I4: No cancel after pickup | Cancel a picked_up order | "Cannot cancel order in 'picked_up' status" | PASS |
| 16 | I6: Rider cancel needs reason | Cancel without reason body | "Reason is required when rider cancels" | PASS |
| 17 | Role enforcement | Rider calls POST /owner/orders | "Role 'rider' is not authorized" | PASS |
| 18 | I2: Single active order | Assign 2nd order to busy rider | "Rider already has an active order" | PASS |
| 19 | Duplicate order dedup | Same phone within 60 seconds | 409 "Duplicate order detected" | PASS |

### Decline Flow

| # | Test | Expected | Result |
|---|------|----------|--------|
| 20 | Rider declines assigned order | status -> pending_assignment, assignedRiderId -> null | PASS |
| 21 | AssignmentLog created (assigned) | action=assigned in history | PASS |
| 22 | AssignmentLog created (declined) | action=declined, reason="Too far away" | PASS |

### Rider Features

| # | Test | Expected | Result |
|---|------|----------|--------|
| 23 | Rider stats | todayDeliveries=2, activeOrder present, acceptanceRate=100 | PASS |
| 24 | Toggle online | isOnline=true, lastOnlineAt set | PASS |

### Owner Features

| # | Test | Expected | Result |
|---|------|----------|--------|
| 25 | List all orders | Returns all orders, sorted newest first, total count | PASS |
| 26 | List riders with status | Shows rider name, isOnline, activeOrder | PASS |
| 27 | Assignment history | Chronological log of assign/decline events with rider names | PASS |

---

## Summary

- **27 tests, 27 passed, 0 failed**
- All 7 tested invariants (I2, I4, I5, I6, I10, role enforcement, dedup) enforced correctly
- Full order lifecycle (pending_assignment -> assigned -> accepted -> picked_up -> delivered) works end to end
- Decline flow correctly reverts to pending_assignment and logs the event
- Rider stats and online toggle work
- Owner CRUD, assignment, rider list, and history all work

## Not Yet Tested (Phase 2+)

- Accept timeout (3 min auto-decline) -- needs cron/scheduler (Phase 2)
- Auto-assignment engine -- not yet built (Phase 2)
- Owner reassignment of accepted order -- transition exists but not tested
- Push notifications -- not yet built (Phase 4)
- Photo upload to Cloudinary -- not yet built (Phase 3)
- Stale accepted warning (20 min) -- needs cron (Phase 2)
- Forgot/reset password email sending -- SMTP not configured
- Prepaid order delivery (no cash check) -- implicit from code, not explicitly tested
- Notifications CRUD -- endpoints exist but no notification creation triggers yet

## Known Issues

None found.

## Database State After Tests

6 orders created (ORD-0001 through ORD-0006). To reset for fresh testing:
```
mongosh Zelvop --eval "db.dropDatabase()"
```

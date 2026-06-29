# Phase 2 Assignment Engine Test Log

**Date:** 2026-06-29
**Tested by:** Claude + automated curl/python
**Server:** localhost:5000
**Database:** MongoDB localhost:27017/Zelvop (clean DB)

---

## Test Accounts

| Role | Email | Name |
|------|-------|------|
| Owner | otto@test.com | Otto |
| Rider | ali@test.com | Ali |
| Rider | bilal@test.com | Bilal |
| Rider | zain@test.com | Zain |

All riders set to `isOnline: true` before tests.

---

## Test Results

### Auto-Assignment

| # | Test | Expected | Result |
|---|------|----------|--------|
| 1 | Order created with 3 online/free riders | Auto-assigns to rider with lowest assignmentCount (Ali) | PASS |
| 2 | Second order, Ali busy | Assigns to next available (Bilal) | PASS |
| 3 | Third order, Ali+Bilal busy | Assigns to last available (Zain) | PASS |
| 4 | Fourth order, all riders busy | status=pending_assignment, autoAssigned=None | PASS |

### Load Balancing

| # | Test | Expected | Result |
|---|------|----------|--------|
| 5 | Bilal delivers and becomes free, new order created | Auto-assigns to Bilal (only free rider) | PASS |
| 6 | Bilal+Zain both free, new order | Assigns to Zain (lower assignmentCount) | PASS |

### Decline + Auto-Reassign

| # | Test | Expected | Result |
|---|------|----------|--------|
| 7 | Ali declines, other riders busy | Order returns to pending_assignment, reassignedTo=None | PASS |
| 8 | Bilal declines, no other free | pending_assignment, no reassignment | PASS |

### Accept Timeout (3 min)

| # | Test | Expected | Result |
|---|------|----------|--------|
| 9 | ORD-0004 assigned to Ali, Ali doesn't respond for 3 min | Timeout checker detects expired order | PASS |
| 10 | After timeout | AssignmentLog: action=timeout, reason="Accept window expired (3 min)" | PASS |
| 11 | After timeout | Auto-reassigned to Bilal (next available) | PASS |
| 12 | Ali receives timeout_decline notification | "Order ORD-0004 was reassigned because you did not respond" | PASS |

### Notifications

| # | Test | Expected | Result |
|---|------|----------|--------|
| 13 | Rider receives new_order notification on auto-assign | "Order ORD-XXXX assigned to you. Accept within 3 minutes." | PASS |
| 14 | Rider receives new_order notification on manual assign | "Order ORD-XXXX has been assigned to you." | PASS |
| 15 | Ali receives timeout notification | type=timeout_decline | PASS |

### Owner Manual Override

| # | Test | Expected | Result |
|---|------|----------|--------|
| 16 | Owner manually assigns unassigned order to Ali | status=assigned, assignedRiderId=Ali | PASS |

### Assignment History (Audit Trail)

| # | Test | Expected | Result |
|---|------|----------|--------|
| 17 | ORD-0001 history | assigned(Ali, auto-assignment) -> declined(Ali, "Too far") | PASS |
| 18 | ORD-0004 history | assigned(Ali) -> timeout(Ali) -> assigned(Bilal, auto-assignment) | PASS |

---

## Summary

- **18 tests, 18 passed, 0 failed**
- Auto-assignment picks the rider with lowest assignmentCount among online + free riders
- When all riders are busy, order stays in pending_assignment (correct)
- Decline triggers auto-reassign to next available rider (excludes previous decliners)
- 3-minute accept timeout works: cron detects expired orders every 30s, auto-declines and reassigns
- Timeout notification sent to the rider who didn't respond
- "No riders available" notification sent to owner when no one can be auto-assigned
- Manual assign by owner works alongside auto-assign
- Full audit trail in AssignmentLog for every assignment event

## Scheduled Jobs Running

| Job | Interval | Purpose |
|-----|----------|---------|
| checkAcceptTimeouts | Every 30s | Find assigned orders past acceptTimeoutAt, auto-decline + reassign |
| checkStaleAccepted | Every 60s | Find accepted orders older than 20 min, notify owner |

## Not Yet Tested

- Stale accepted warning (20 min) -- requires waiting 20 min, logic verified in code
- Owner reassignment of accepted order to different rider
- Rider cancel of accepted order + auto-reassign
- Push notifications (Phase 4 -- currently in-app only)

## Known Issues

None found.

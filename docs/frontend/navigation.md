# Frontend Navigation

Describes routing, guards, redirects, and link handling as observed by the user.
Business rules are owned by the backend docs (`docs/backend/`).

The app uses file-based routing. Routes are grouped into an auth group and a
tab group, plus standalone order routes.

---

## Routes and entry points

| Route | Screen | Entry point |
|-------|--------|-------------|
| `/` | Index (redirect only) | Cold start / root |
| `/(auth)/login` | Login | Signed-out users; sign-out |
| `/(auth)/signup` | Sign Up | From Login |
| `/(auth)/forgot-password` | Forgot Password | From Login |
| `/(tabs)/home` | Home | Default after login |
| `/(tabs)/orders` | Orders | Tab bar; "See All" on Home |
| `/(tabs)/notifications` | Alerts | Tab bar; bell on Home |
| `/(tabs)/profile` | Profile | Tab bar |
| `/order/[id]` | Order Detail | Order cards, banners, notifications |
| `/order/confirm-delivery` | Confirm Delivery | From Order Detail (picked-up) |

The four tabs are Home, Orders, Alerts, and Profile. The Alerts tab icon shows an
unread-count badge.

---

## Guarded routes and conditions

Guarding is session-based (presence of a persisted auth token), applied globally:

- While the app has not finished initializing, the Splash screen is shown and no
  route is presented.
- If there is **no** session and the user is **not** in the auth group, they are
  redirected to Login.
- If there **is** a session and the user **is** in the auth group, they are
  redirected to Home.

There is no per-role route guarding in the client; the app targets riders only.
Authorization for data and actions is enforced by the backend (see
`docs/backend/invariants.md`).

---

## Redirect behavior

- **Root (`/`):** redirects to Home when a token exists, otherwise to Login.
- **Session gained (login/signup success):** user leaves the auth group and lands
  on Home.
- **Session lost (logout, or failed session restore):** user is returned to
  Login.
- **Post-delivery:** after confirming a delivery, the user is routed to the
  Orders tab (replacing history, so back does not return to the confirm screen).

---

## Deep-link / parameter handling

- **In-app parameters:** Order Detail is addressed by an order id
  (`/order/[id]`). Confirm Delivery receives order id, order number, customer
  name, total amount, and payment method as parameters passed from Order Detail.
- **Notification -> order:** tapping a notification that references an order
  navigates to that order's detail.

## Outbound (external) links

These launch other apps rather than navigating within the app:

- **Call:** dials the customer phone number.
- **WhatsApp:** opens a WhatsApp conversation for the customer number.
- **Open in Maps:** opens the delivery address in an external maps URL.

The app does not register inbound OS deep links beyond the standard routes above.

# TRUSTON (Arise Capital) — Inventory & Cost Sheet System

Real estate inventory management + cost-sheet generation system for the TRUSTON
commercial project at Sr. No. 130, Wakad, Pune. Built the same way as your
Sahjeevan system: Supabase backend (Postgres + Auth + RLS), fully static
frontend, deployable directly on GitHub Pages.

## What's inside

- **447 units** pre-loaded: 388 Studio/Hostel rooms, 54 Offices, 2 Showrooms, 3 Shops
- **Three roles**: **Admin** (full control), **Site Head** (can edit any booking, same as admin), **Sales** (day-to-day booking)
- **Live inventory grid**: Available / On Hold / Sold / Blocked, filterable by category, floor, status
- **Booking flow**: capture customer details → auto-generates a 2-page cost sheet PDF (Agreement Value, Stamp Duty, Registration, GST, Total Package, amount in words, Payment Schedule, Terms & Conditions)
- **Bookings panel**: Admin + Site Head can view every booking and **edit** it (customer details, pricing); Admin can also cancel a booking (releases the unit back to Available)
- **Audit Log** (Admin only): every booking edit, cancellation, unit status/price override, user-role change, and system reset is logged with **who did it and exactly what changed** (before/after values)
- **Reset System** (Admin only): one button, behind a typed "RESET" confirmation, that sets every unit back to Available and cancels every active booking — fully logged in the Audit Log
- **Admin-only Export to Excel** button — downloads the full live inventory as `.xlsx`
- **Admin-only** unit status override and price override (for one-off negotiated deals)

## ⚠️ Assumptions you should double-check

1. **Payment Schedule** in `js/config.js` (`PAYMENT_SCHEDULE`) is a **placeholder** — you said to use one for now. Replace stage names/percentages with the real Stage-of-Payment slabs whenever you have them; it's printed on every cost sheet.
2. **Shop 3 & Shop 4** — the source documents only gave a *combined* carpet area (491.16 sq.ft) and one price point for both. Since you confirmed they're separate units and the floor plan shows identical dimensions for both, I split the area/price evenly between `SHOP-01` (Shop 3) and `SHOP-02` (Shop 4), each getting a full ₹30,000 registration fee. If the actual individual pricing differs, edit those two rows directly in Supabase (`units` table) or re-run part of the seed script.
3. Unit ID format: `STU-FFRR` (Studio, floor+room), `OFC-FRR` (Office, floor+unit), `SHOW-01/02` (Showroom), `SHOP-01/02/03` (Shop) — matching the convention you gave for offices.

## Setup (≈15 minutes)

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com) → New Project → wait ~2 minutes for provisioning.

### 2. Run the SQL — in order
Supabase Dashboard → **SQL Editor** → paste and run, in this order:
1. `supabase/schema.sql` — tables, RLS policies, admin/sales functions
2. `supabase/seed_data.sql` — all 447 units

### 3. Create your first Admin user — entirely inside the app, no dashboard step
- Open your deployed site. Since no account exists yet, the login screen shows
  **"No admin account exists yet → Create the first admin account"**.
- Click it, enter your name/email/password, submit. **This first signup is
  automatically made admin** — enforced by a database trigger (`handle_new_user`
  in `schema.sql`), not just the frontend, so it can't be spoofed. The Sign Up
  option disappears for everyone once that first account exists.
- **All further users are added by the admin from inside the app**: top bar →
  **Manage Users → + Add New User** (name, email, temporary password, role).
  Share those credentials with them directly; they can change their password
  afterwards via **Change Password** in the top bar.
- Admins can promote/demote anyone's role at any time from the same
  **Manage Users** screen — no SQL needed for that either.
- There's no Edge Function and no service-role key anywhere in this flow — "Add
  New User" uses a throwaway, non-persisted Supabase client under the hood so
  creating an account never disturbs the admin's own logged-in session.
- ⚠️ If you ever see `auth.signUp` disabled errors, check Supabase →
  Authentication → Providers → Email → make sure "Allow new users to sign up"
  is turned ON (it's needed both for the bootstrap admin and for Add New User).

### 4. Configure the frontend
Open `js/config.js` and set:
```js
const SUPABASE_URL = "https://xxxxx.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-public-key";
```
(Both are in Supabase → Settings → API. The anon key is safe to expose publicly — RLS protects the data.)

### 5. Deploy on GitHub Pages
- Push this whole folder to a GitHub repo
- Settings → Pages → Deploy from branch → `main` → `/ (root)`
- Live at `https://<your-username>.github.io/<repo-name>/`

## Roles at a glance

| Action | Sales | Site Head | Admin |
|---|---|---|---|
| View inventory grid | ✅ | ✅ | ✅ |
| Place / release a Hold | ✅ | ✅ | ✅ |
| Create a booking (generates cost sheet PDF) | ✅ | ✅ | ✅ |
| View Bookings panel | ❌ | ✅ | ✅ |
| **Edit a booking** (customer details, pricing) | ❌ | ✅ | ✅ |
| Cancel a booking | ❌ | ❌ | ✅ |
| View Audit Log | ❌ | ❌ | ✅ |
| Reset entire system | ❌ | ❌ | ✅ |
| Override agreement value on a booking | ❌ | ❌ | ✅ |
| Force-set any unit's status (available/sold/blocked) | ❌ | ❌ | ✅ |
| Export full inventory to Excel | ❌ | ❌ | ✅ |
| Add new users | ❌ | ❌ | ✅ |
| Change other users' role | ❌ | ❌ | ✅ |
| Change own password | ✅ | ✅ | ✅ |

## File structure
```
truston-inventory-system/
├── index.html
├── css/style.css
├── js/
│   ├── config.js      ← project info, RERA no., payment schedule, T&Cs — EDIT THIS
│   └── app.js          ← all application logic
├── supabase/
│   ├── schema.sql       ← run first
│   └── seed_data.sql    ← run second (447 units)
└── README.md
```

## Troubleshooting: "I can't log in / sign up"

Work through these in order — in practice it's almost always #1 or #2:

1. **Is `js/config.js` actually filled in?** If `SUPABASE_URL` or `SUPABASE_ANON_KEY` still contain the placeholder text `YOUR_SUPABASE...`, the app shows an error banner on the login screen saying so and stops there. Open browser DevTools (F12) → Console to confirm.

2. **Is "Confirm email" turned on in your Supabase project, with no email provider configured?** This is the #1 cause of "sign up seems to work but I can never log in." By default, Supabase requires the user to click a confirmation link before their first login. If you haven't set up a custom SMTP provider, that email either never arrives or lands in spam — so the account exists but is stuck "unconfirmed" forever.
   - Fix: Supabase Dashboard → **Authentication → Providers → Email** → turn **OFF** "Confirm email" (fine for an internal sales tool). Then sign up again (or re-run schema.sql + seed_data.sql for a clean slate and sign up fresh).
   - Alternative: keep confirmation on, but check the spam folder for the confirmation email, or manually confirm the user in **Authentication → Users** (there's a "..." menu → Confirm, or set `email_confirmed_at` via SQL).

3. **Did `schema.sql` fully succeed?** If any earlier statement errored partway through, the trigger `on_auth_user_created` might not exist, meaning sign-up creates an `auth.users` row but never creates the matching `profiles` row — login then fails at "Could not load your profile." Re-run the whole `schema.sql` (it's designed to be dropped/rebuilt safely) and check the SQL Editor output for errors before re-trying.

4. **Check the exact error text.** Both the Sign In and Sign Up forms display the real Supabase error message in a red banner right above the form fields — whatever it says there (e.g. "Invalid login credentials", "Email not confirmed", "User already registered") points at the exact cause. If you're still stuck, share that exact message and I can pinpoint it precisely.

## Notes
- Prices are exactly as given in your cost sheet (per unit type/carpet size), applied consistently regardless of floor — as you confirmed for offices, and same logic applied to studios/showrooms/shops.
- All monetary values are stored as plain numbers (INR) in Supabase — no currency conversion.
- No logo file is bundled; drop one at `assets/logo.png` if you want it on the PDF later (currently the PDF uses a text header only, no logo).

-- =====================================================================
-- TRUSTON (Arise Capital) — Inventory & Cost Sheet System
-- FULL REBUILD SCRIPT — this DROPS everything below and recreates it
-- from scratch. Safe to re-run any time you want a clean slate.
--
-- Order to run in Supabase SQL Editor:
--   1) schema.sql       (this file)
--   2) seed_data.sql    (the 447 units)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) DROP EVERYTHING (idempotent clean slate)
-- ---------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.is_admin_or_site_head() cascade;
drop function if exists public.needs_bootstrap() cascade;
drop function if exists public.internal_log_audit(text, text, text, text, jsonb, jsonb) cascade;
drop function if exists public.sales_set_hold(text, boolean) cascade;
drop function if exists public.admin_set_unit_status(text, text) cascade;
drop function if exists public.admin_update_unit_price(text, numeric, numeric, numeric, numeric, numeric) cascade;
drop function if exists public.create_booking(text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric) cascade;
drop function if exists public.edit_booking(uuid, text, text, text, numeric, numeric, numeric, numeric, numeric) cascade;
drop function if exists public.admin_cancel_booking(uuid) cascade;
drop function if exists public.admin_reset_all_units() cascade;
drop function if exists public.admin_set_user_role(uuid, text) cascade;

drop table if exists public.audit_log cascade;
drop table if exists public.bookings cascade;
drop table if exists public.units cascade;
drop table if exists public.profiles cascade;

-- ---------------------------------------------------------------------
-- 1) PROFILES — roles: admin, site_head, sales
--    NOTE: RLS is enabled and the policy is created further down, AFTER
--    the is_admin() helper exists (see section 3B). Creating the policy
--    too early — or writing it as a raw subquery on profiles itself —
--    causes "infinite recursion detected in policy for relation profiles",
--    because a plain subquery re-triggers this same SELECT policy on
--    itself. Routing the admin check through a SECURITY DEFINER function
--    avoids that: the function runs as the table owner, which bypasses
--    RLS entirely, so there's no self-reference.
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  role text not null default 'sales' check (role in ('admin','site_head','sales')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) BOOTSTRAP TRIGGER — first person to ever sign up becomes admin.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_is_first;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case when v_is_first then 'admin' else 'sales' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3A) HELPERS (must exist before we create any policy that calls them)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

grant execute on function public.is_admin() to authenticated;

create or replace function public.is_admin_or_site_head()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','site_head'));
$$;

grant execute on function public.is_admin_or_site_head() to authenticated;

create or replace function public.needs_bootstrap()
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles);
$$;

grant execute on function public.needs_bootstrap() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3B) NOW enable RLS on profiles and create its policy, using is_admin()
--     instead of a raw self-referencing subquery.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (
    auth.uid() = id
    or public.is_admin()
  );

-- No direct UPDATE policy — role changes go only through admin_set_user_role().

-- ---------------------------------------------------------------------
-- 4) AUDIT LOG — every sensitive write goes through internal_log_audit()
-- ---------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_name text,
  actor_role text,
  action text not null,          -- e.g. 'booking_edited', 'booking_created', 'unit_status_changed'
  table_name text not null,
  record_id text,
  description text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "audit_log_select_admin_only"
  on public.audit_log for select
  using ( public.is_admin() );

-- Inserts only ever happen via internal_log_audit(), called from within
-- other SECURITY DEFINER functions — no direct insert policy needed/granted.

create or replace function public.internal_log_audit(
  p_action text, p_table_name text, p_record_id text,
  p_description text, p_old_data jsonb, p_new_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_role text;
begin
  select full_name, role into v_name, v_role from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_id, actor_name, actor_role, action, table_name, record_id, description, old_data, new_data)
  values (auth.uid(), coalesce(v_name, 'Unknown'), coalesce(v_role, 'unknown'), p_action, p_table_name, p_record_id, p_description, p_old_data, p_new_data);
end;
$$;

-- ---------------------------------------------------------------------
-- 5) UNITS (master inventory)
-- ---------------------------------------------------------------------
create table public.units (
  id text primary key,
  category text not null check (category in ('Studio','Office','Showroom','Shop')),
  type text not null,
  floor int not null,
  unit_label text not null,
  carpet numeric not null,
  saleable numeric not null,
  agreement_value numeric not null,
  stamp_duty numeric not null,
  registration numeric not null,
  gst numeric not null,
  package numeric not null,
  status text not null default 'available' check (status in ('available','on_hold','sold','blocked')),
  note text,
  updated_at timestamptz not null default now()
);

alter table public.units enable row level security;

create policy "units_select_all_authenticated"
  on public.units for select
  using ( auth.role() = 'authenticated' );

-- All writes to units go through the security-definer functions below.

-- ---------------------------------------------------------------------
-- 6) BOOKINGS
-- ---------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null references public.units(id),

  -- Section 1: Applicant Details
  customer_name text not null,               -- Sole / First Applicant Name
  co_applicant_name text,
  father_spouse_name text,
  permanent_address text,
  correspondence_address text,
  customer_phone text,                       -- Mobile No
  customer_email text,                       -- Email ID

  -- Section 2: Property Preference & Selection
  parking_requirement text check (parking_requirement in ('covered','none')) default 'none',
  parking_count int,

  -- Section 3: Financials & Payment Details
  agreement_value numeric not null,          -- used as Basic Sale Price (BSP)
  stamp_duty_rate numeric not null default 7 check (stamp_duty_rate in (6,7)),
  stamp_duty numeric not null,
  registration numeric not null,
  gst numeric not null,
  package numeric not null,
  booking_amount_paid numeric,
  payment_mode text check (payment_mode in ('Cheque','DD','NEFT','RTGS')),
  payment_ref_no text,
  payment_plan text check (payment_plan in ('down_payment','construction_linked','flexi')),

  -- Admin-only internal tracking. Deliberately NOT part of agreement_value/
  -- stamp_duty/gst/package math and NOT printed on the official booking form —
  -- see schema notes: this must never reduce the registered consideration.
  furniture_cost numeric default 0,

  booking_date date not null default current_date,
  created_by uuid references public.profiles(id),
  status text not null default 'active' check (status in ('active','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

create policy "bookings_select_authenticated"
  on public.bookings for select
  using ( auth.role() = 'authenticated' );

-- No direct insert/update policy — goes only through the functions below.

-- ---------------------------------------------------------------------
-- 7) SALES: place / release a hold
-- ---------------------------------------------------------------------
create or replace function public.sales_set_hold(p_unit_id text, p_hold boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if p_hold then
    update public.units set status = 'on_hold', updated_at = now()
      where id = p_unit_id and status = 'available';
  else
    update public.units set status = 'available', updated_at = now()
      where id = p_unit_id and status = 'on_hold';
  end if;
end;
$$;

grant execute on function public.sales_set_hold(text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 8) ADMIN: force-set unit status
-- ---------------------------------------------------------------------
create or replace function public.admin_set_unit_status(p_unit_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old record;
begin
  if not public.is_admin() then
    raise exception 'Only admin can change unit status directly';
  end if;
  if p_status not in ('available','on_hold','sold','blocked') then
    raise exception 'Invalid status';
  end if;

  select * into v_old from public.units where id = p_unit_id;
  update public.units set status = p_status, updated_at = now() where id = p_unit_id;

  perform public.internal_log_audit(
    'unit_status_changed', 'units', p_unit_id,
    format('Status changed from %s to %s', v_old.status, p_status),
    jsonb_build_object('status', v_old.status),
    jsonb_build_object('status', p_status)
  );
end;
$$;

grant execute on function public.admin_set_unit_status(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 9) ADMIN: override pricing on a unit
-- ---------------------------------------------------------------------
create or replace function public.admin_update_unit_price(
  p_unit_id text, p_agreement_value numeric, p_stamp_duty numeric,
  p_registration numeric, p_gst numeric, p_package numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old record;
begin
  if not public.is_admin() then
    raise exception 'Only admin can update pricing';
  end if;

  select * into v_old from public.units where id = p_unit_id;

  update public.units set
    agreement_value = p_agreement_value, stamp_duty = p_stamp_duty,
    registration = p_registration, gst = p_gst, package = p_package, updated_at = now()
  where id = p_unit_id;

  perform public.internal_log_audit(
    'unit_price_changed', 'units', p_unit_id, 'Unit pricing overridden by admin',
    to_jsonb(v_old), jsonb_build_object(
      'agreement_value', p_agreement_value, 'stamp_duty', p_stamp_duty,
      'registration', p_registration, 'gst', p_gst, 'package', p_package
    )
  );
end;
$$;

grant execute on function public.admin_update_unit_price(text, numeric, numeric, numeric, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 10) Create a booking (sales/site_head/admin) — marks unit as sold
-- ---------------------------------------------------------------------
create or replace function public.create_booking(
  p_unit_id text, p_customer_name text, p_customer_phone text, p_customer_email text,
  p_agreement_value numeric, p_stamp_duty numeric, p_registration numeric,
  p_gst numeric, p_package numeric, p_apr_override numeric default null,
  p_co_applicant_name text default null, p_father_spouse_name text default null,
  p_permanent_address text default null, p_correspondence_address text default null,
  p_parking_requirement text default 'none', p_parking_count int default null,
  p_booking_amount_paid numeric default null, p_payment_mode text default null,
  p_payment_ref_no text default null, p_payment_plan text default null,
  p_stamp_duty_rate numeric default 7, p_furniture_cost numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_status text;
  v_furniture_cost numeric;
begin
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select status into v_status from public.units where id = p_unit_id;
  if v_status = 'sold' then
    raise exception 'Unit already sold';
  end if;
  if v_status = 'blocked' and not public.is_admin() then
    raise exception 'Unit is blocked by admin';
  end if;

  -- furniture_cost is admin-only; silently zero it out for non-admins
  -- rather than trusting the client to have hidden the field.
  v_furniture_cost := case when public.is_admin() then coalesce(p_furniture_cost, 0) else 0 end;

  insert into public.bookings (
    unit_id, customer_name, customer_phone, customer_email,
    agreement_value, stamp_duty_rate, stamp_duty, registration, gst, package, created_by,
    co_applicant_name, father_spouse_name, permanent_address, correspondence_address,
    parking_requirement, parking_count, booking_amount_paid, payment_mode, payment_ref_no, payment_plan,
    furniture_cost
  ) values (
    p_unit_id, p_customer_name, p_customer_phone, p_customer_email,
    p_agreement_value, coalesce(p_stamp_duty_rate, 7), p_stamp_duty, p_registration, p_gst, p_package, auth.uid(),
    p_co_applicant_name, p_father_spouse_name, p_permanent_address, p_correspondence_address,
    coalesce(p_parking_requirement, 'none'), p_parking_count, p_booking_amount_paid, p_payment_mode, p_payment_ref_no, p_payment_plan,
    v_furniture_cost
  ) returning id into v_booking_id;

  update public.units set status = 'sold', updated_at = now() where id = p_unit_id;

  perform public.internal_log_audit(
    'booking_created', 'bookings', v_booking_id::text,
    format('Booking created for %s on unit %s', p_customer_name, p_unit_id),
    null,
    jsonb_build_object('unit_id', p_unit_id, 'customer_name', p_customer_name, 'package', p_package)
  );

  return v_booking_id;
end;
$$;

grant execute on function public.create_booking(
  text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric,
  text, text, text, text, text, int, numeric, text, text, text, numeric, numeric
) to authenticated;

-- ---------------------------------------------------------------------
-- 11) EDIT a booking — Admin or Site Head only. Fully audited.
-- ---------------------------------------------------------------------
create or replace function public.edit_booking(
  p_booking_id uuid, p_customer_name text, p_customer_phone text, p_customer_email text,
  p_agreement_value numeric, p_stamp_duty numeric, p_registration numeric,
  p_gst numeric, p_package numeric,
  p_co_applicant_name text default null, p_father_spouse_name text default null,
  p_permanent_address text default null, p_correspondence_address text default null,
  p_parking_requirement text default 'none', p_parking_count int default null,
  p_booking_amount_paid numeric default null, p_payment_mode text default null,
  p_payment_ref_no text default null, p_payment_plan text default null,
  p_stamp_duty_rate numeric default 7, p_furniture_cost numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old record;
  v_furniture_cost numeric;
begin
  if not public.is_admin_or_site_head() then
    raise exception 'Only Admin or Site Head can edit a booking';
  end if;

  select * into v_old from public.bookings where id = p_booking_id;
  if v_old.id is null then
    raise exception 'Booking not found';
  end if;

  -- furniture_cost is admin-only; a Site Head's edit leaves it untouched,
  -- and even an admin's null input leaves the existing value as-is.
  v_furniture_cost := case
    when not public.is_admin() then v_old.furniture_cost
    when p_furniture_cost is null then v_old.furniture_cost
    else p_furniture_cost
  end;

  update public.bookings set
    customer_name = p_customer_name,
    customer_phone = p_customer_phone,
    customer_email = p_customer_email,
    agreement_value = p_agreement_value,
    stamp_duty_rate = coalesce(p_stamp_duty_rate, v_old.stamp_duty_rate, 7),
    stamp_duty = p_stamp_duty,
    registration = p_registration,
    gst = p_gst,
    package = p_package,
    co_applicant_name = p_co_applicant_name,
    father_spouse_name = p_father_spouse_name,
    permanent_address = p_permanent_address,
    correspondence_address = p_correspondence_address,
    parking_requirement = coalesce(p_parking_requirement, 'none'),
    parking_count = p_parking_count,
    booking_amount_paid = p_booking_amount_paid,
    payment_mode = p_payment_mode,
    payment_ref_no = p_payment_ref_no,
    payment_plan = p_payment_plan,
    furniture_cost = v_furniture_cost,
    updated_at = now()
  where id = p_booking_id;

  perform public.internal_log_audit(
    'booking_edited', 'bookings', p_booking_id::text,
    format('Booking for %s edited', v_old.customer_name),
    to_jsonb(v_old),
    jsonb_build_object(
      'customer_name', p_customer_name, 'customer_phone', p_customer_phone, 'customer_email', p_customer_email,
      'agreement_value', p_agreement_value, 'stamp_duty_rate', p_stamp_duty_rate, 'stamp_duty', p_stamp_duty,
      'registration', p_registration, 'gst', p_gst, 'package', p_package,
      'co_applicant_name', p_co_applicant_name, 'father_spouse_name', p_father_spouse_name,
      'permanent_address', p_permanent_address, 'correspondence_address', p_correspondence_address,
      'parking_requirement', p_parking_requirement, 'parking_count', p_parking_count,
      'booking_amount_paid', p_booking_amount_paid, 'payment_mode', p_payment_mode,
      'payment_ref_no', p_payment_ref_no, 'payment_plan', p_payment_plan,
      'furniture_cost', v_furniture_cost
    )
  );
end;
$$;

grant execute on function public.edit_booking(
  uuid, text, text, text, numeric, numeric, numeric, numeric, numeric,
  text, text, text, text, text, int, numeric, text, text, text, numeric, numeric
) to authenticated;

-- ---------------------------------------------------------------------
-- 12) ADMIN: cancel a booking (frees the unit)
-- ---------------------------------------------------------------------
create or replace function public.admin_cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_id text;
  v_old record;
begin
  if not public.is_admin() then
    raise exception 'Only admin can cancel bookings';
  end if;

  select * into v_old from public.bookings where id = p_booking_id;

  update public.bookings set status = 'cancelled', updated_at = now() where id = p_booking_id
    returning unit_id into v_unit_id;

  if v_unit_id is not null then
    update public.units set status = 'available', updated_at = now() where id = v_unit_id;
  end if;

  perform public.internal_log_audit(
    'booking_cancelled', 'bookings', p_booking_id::text,
    format('Booking for %s cancelled, unit %s released', v_old.customer_name, v_unit_id),
    to_jsonb(v_old), jsonb_build_object('status', 'cancelled')
  );
end;
$$;

grant execute on function public.admin_cancel_booking(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 13) ADMIN: reset entire system back to available / clear bookings
-- ---------------------------------------------------------------------
create or replace function public.admin_reset_all_units()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_units_count int;
  v_bookings_count int;
begin
  if not public.is_admin() then
    raise exception 'Only admin can reset inventory';
  end if;

  select count(*) into v_units_count from public.units where status != 'available';
  select count(*) into v_bookings_count from public.bookings where status = 'active';

  update public.units set status = 'available', updated_at = now();
  update public.bookings set status = 'cancelled', updated_at = now() where status = 'active';

  perform public.internal_log_audit(
    'system_reset', 'units', null,
    format('System reset: %s units returned to available, %s active bookings cancelled', v_units_count, v_bookings_count),
    null, null
  );
end;
$$;

grant execute on function public.admin_reset_all_units() to authenticated;

-- ---------------------------------------------------------------------
-- 14) ADMIN: change another user's role (admin / site_head / sales)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_role text;
  v_target_name text;
begin
  if not public.is_admin() then
    raise exception 'Only admin can change user roles';
  end if;
  if p_role not in ('admin','site_head','sales') then
    raise exception 'Invalid role';
  end if;

  select role, full_name into v_old_role, v_target_name from public.profiles where id = p_user_id;

  update public.profiles set role = p_role where id = p_user_id;

  perform public.internal_log_audit(
    'user_role_changed', 'profiles', p_user_id::text,
    format('Role for %s changed from %s to %s', v_target_name, v_old_role, p_role),
    jsonb_build_object('role', v_old_role), jsonb_build_object('role', p_role)
  );
end;
$$;

grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

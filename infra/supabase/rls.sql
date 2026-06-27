-- ============================================================
-- VizAI Inventory — Row Level Security policies
-- Role hierarchy: super_admin > manager > ops > user
-- All policies are org-scoped: users only see their own org
-- ============================================================

-- Helper: get current user's role from users table
create or replace function auth_role()
returns text language sql stable as $$
  select role from users where id = auth.uid()
$$;

-- Helper: get current user's org_id
create or replace function auth_org()
returns uuid language sql stable as $$
  select org_id from users where id = auth.uid()
$$;

-- ── ORGANISATIONS ────────────────────────────────────────────
alter table organisations enable row level security;

-- Super admin: see all orgs
create policy "super_admin_orgs_all" on organisations
  for all using (auth_role() = 'super_admin');

-- Others: only own org
create policy "users_own_org" on organisations
  for select using (id = auth_org());

-- ── USERS ────────────────────────────────────────────────────
alter table users enable row level security;

-- Super admin: manage all users in own org
create policy "super_admin_users" on users
  for all using (auth_role() = 'super_admin' and org_id = auth_org());

-- Manager: view all users in org
create policy "manager_view_users" on users
  for select using (auth_role() = 'manager' and org_id = auth_org());

-- Ops + user: view only own record
create policy "user_own_record" on users
  for select using (id = auth.uid());

-- ── ITEMS ────────────────────────────────────────────────────
alter table items enable row level security;

-- Super admin + manager: full access within org
create policy "admin_manager_items" on items
  for all using (
    org_id = auth_org() and auth_role() in ('super_admin','manager')
  );

-- Ops: read + update (for flagging condition), no delete
create policy "ops_items_read" on items
  for select using (org_id = auth_org() and auth_role() = 'ops');

create policy "ops_items_update" on items
  for update using (org_id = auth_org() and auth_role() = 'ops');

-- User: read whitelisted active items only
create policy "user_items_read" on items
  for select using (
    org_id = auth_org()
    and auth_role() = 'user'
    and is_whitelisted = true
    and status = 'active'
  );

-- ── STOCK LEDGER ─────────────────────────────────────────────
alter table stock_ledger enable row level security;

-- Super admin + manager: full access
create policy "admin_manager_ledger" on stock_ledger
  for all using (
    org_id = auth_org() and auth_role() in ('super_admin','manager')
  );

-- Ops: read + insert (record movements)
create policy "ops_ledger_read" on stock_ledger
  for select using (org_id = auth_org() and auth_role() = 'ops');

create policy "ops_ledger_insert" on stock_ledger
  for insert with check (org_id = auth_org() and auth_role() = 'ops');

-- User: read own movements only
create policy "user_ledger_own" on stock_ledger
  for select using (org_id = auth_org() and raised_by = auth.uid());

-- ── PURCHASE ORDERS ──────────────────────────────────────────
alter table purchase_orders enable row level security;

-- Super admin + manager: full access
create policy "admin_manager_pos" on purchase_orders
  for all using (
    org_id = auth_org() and auth_role() in ('super_admin','manager')
  );

-- Ops: read + create (cannot delete or see cost data via RLS)
create policy "ops_pos_read" on purchase_orders
  for select using (org_id = auth_org() and auth_role() = 'ops');

create policy "ops_pos_create" on purchase_orders
  for insert with check (org_id = auth_org() and auth_role() = 'ops');

-- Ops can update status (confirm, ship, receive)
create policy "ops_pos_update" on purchase_orders
  for update using (org_id = auth_org() and auth_role() = 'ops');

-- User: see own requests only
create policy "user_pos_own" on purchase_orders
  for select using (
    org_id = auth_org()
    and auth_role() = 'user'
    and created_by = auth.uid()
  );

-- ── SUPPLIERS ────────────────────────────────────────────────
alter table suppliers enable row level security;

-- Super admin + manager: full access
create policy "admin_manager_suppliers" on suppliers
  for all using (
    org_id = auth_org() and auth_role() in ('super_admin','manager')
  );

-- Ops: read only (for raising POs)
create policy "ops_suppliers_read" on suppliers
  for select using (org_id = auth_org() and auth_role() = 'ops');

-- User: no access to supplier data

-- ── NOTIFICATIONS ────────────────────────────────────────────
alter table notifications enable row level security;

-- All roles: see own org notifications, update own (mark read)
create policy "all_notifs_read" on notifications
  for select using (org_id = auth_org());

create policy "all_notifs_update_read" on notifications
  for update using (org_id = auth_org())
  with check (
    org_id = auth_org()
    and (user_id = auth.uid() or auth_role() in ('super_admin','manager'))
  );

-- Only backend (service role) inserts notifications
-- No insert policy = only service_role key can insert

-- ── CONDITION FLAGS ──────────────────────────────────────────
alter table condition_flags enable row level security;

-- Super admin + manager: full access
create policy "admin_manager_flags" on condition_flags
  for all using (
    org_id = auth_org() and auth_role() in ('super_admin','manager')
  );

-- Ops: read + create flags
create policy "ops_flags_read" on condition_flags
  for select using (org_id = auth_org() and auth_role() = 'ops');

create policy "ops_flags_create" on condition_flags
  for insert with check (org_id = auth_org() and auth_role() = 'ops');

-- User: read flags on their items
create policy "user_flags_read" on condition_flags
  for select using (org_id = auth_org() and auth_role() = 'user');

-- ── WHITELIST LOG ────────────────────────────────────────────
alter table whitelist_log enable row level security;

-- Super admin + manager only (audit trail)
create policy "admin_manager_wl_log" on whitelist_log
  for select using (
    org_id = auth_org() and auth_role() in ('super_admin','manager')
  );

-- Only service role inserts (via MCP whitelist-check endpoint)

-- ── AUDIT LOG ────────────────────────────────────────────────
alter table audit_log enable row level security;

-- Super admin only: full audit trail
create policy "super_admin_audit" on audit_log
  for select using (
    org_id = auth_org() and auth_role() = 'super_admin'
  );

-- ── REPORT CACHE ─────────────────────────────────────────────
alter table report_cache enable row level security;

-- Manager + super admin: read cached reports
create policy "admin_manager_report_cache" on report_cache
  for select using (
    org_id = auth_org() and auth_role() in ('super_admin','manager')
  );

-- ── IOT DEVICES ──────────────────────────────────────────────
alter table iot_devices enable row level security;

-- Super admin + manager: full access
create policy "admin_manager_iot" on iot_devices
  for all using (
    org_id = auth_org() and auth_role() in ('super_admin','manager')
  );

-- Ops: read (monitor devices)
create policy "ops_iot_read" on iot_devices
  for select using (org_id = auth_org() and auth_role() = 'ops');

-- ── AMC CONTRACTS ────────────────────────────────────────────
alter table amc_contracts enable row level security;

-- Manager + super admin only
create policy "admin_manager_amc" on amc_contracts
  for all using (
    org_id = auth_org() and auth_role() in ('super_admin','manager')
  );

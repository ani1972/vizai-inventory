-- ============================================================
-- VizAI Inventory — complete schema
-- Req: all 17 requirements, index-optimised, partition-ready
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- ============================================================
-- ORGANISATIONS
-- ============================================================
create table organisations (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  plan          text not null default 'local' check (plan in ('local','pro','team','enterprise')),
  product_limit int  not null default 500,
  zoho_org_id   text,
  zoho_dc       text default 'in' check (zoho_dc in ('in','us','eu','au','jp','ca')),
  created_at    timestamptz not null default now()
);

-- ============================================================
-- USERS  (role hierarchy: super_admin > manager > ops > user)
-- ============================================================
create table users (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organisations(id) on delete cascade,
  name        text not null,
  email       text not null unique,
  role        text not null default 'user' check (role in ('super_admin','manager','ops','user')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index idx_users_org_role on users(org_id, role);

-- ============================================================
-- ITEMS  (whitelist enforced here)
-- ============================================================
create table items (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  sku             text not null,
  name            text not null,
  category        text not null,
  unit            text not null default 'unit',
  reorder_point   int  not null default 0,
  is_whitelisted  boolean not null default true,
  status          text not null default 'active' check (status in ('active','quarantined','discontinued')),
  unit_cost_inr   numeric(12,2),
  zoho_item_id    text,
  created_at      timestamptz not null default now(),
  constraint uq_item_sku_org unique (sku, org_id)
);
-- Critical indexes for chatbot + dashboard
create unique index idx_items_sku_org    on items(sku, org_id);
create        index idx_items_org_status on items(org_id, status);
create        index idx_items_whitelist  on items(org_id, is_whitelisted) where is_whitelisted = false;

-- ============================================================
-- STOCK LEDGER  (partitioned by month for elasticity)
-- ============================================================
create table stock_ledger (
  id              uuid          not null default uuid_generate_v4(),
  item_id         uuid          not null references items(id),
  org_id          uuid          not null references organisations(id),
  quantity_change int           not null,
  balance_after   int           not null,
  movement_type   text          not null check (movement_type in ('in','out','adjustment','zo_sync')),
  reference_id    text,
  raised_by       uuid          references users(id),
  created_at      timestamptz   not null default now()
) partition by range (created_at);

-- Create monthly partitions (current + 12 months forward)
create table stock_ledger_2025_06 partition of stock_ledger
  for values from ('2025-06-01') to ('2025-07-01');
create table stock_ledger_2025_07 partition of stock_ledger
  for values from ('2025-07-01') to ('2025-08-01');
create table stock_ledger_2025_08 partition of stock_ledger
  for values from ('2025-08-01') to ('2025-09-01');
create table stock_ledger_2025_09 partition of stock_ledger
  for values from ('2025-09-01') to ('2025-10-01');
create table stock_ledger_2025_10 partition of stock_ledger
  for values from ('2025-10-01') to ('2025-11-01');
create table stock_ledger_2025_11 partition of stock_ledger
  for values from ('2025-11-01') to ('2025-12-01');
create table stock_ledger_2025_12 partition of stock_ledger
  for values from ('2025-12-01') to ('2026-01-01');
create table stock_ledger_2026_01 partition of stock_ledger
  for values from ('2026-01-01') to ('2026-02-01');
create table stock_ledger_2026_02 partition of stock_ledger
  for values from ('2026-02-01') to ('2026-03-01');
create table stock_ledger_default partition of stock_ledger default;

-- Critical index on every partition (inherits automatically in PG14+)
create index idx_stock_ledger_item_date on stock_ledger(item_id, created_at desc);
create index idx_stock_ledger_org_date  on stock_ledger(org_id, created_at desc);

-- ============================================================
-- SUPPLIERS
-- ============================================================
create table suppliers (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  name            text not null,
  contact_email   text,
  contact_phone   text,
  avg_lead_days   numeric(5,1),
  fill_rate_pct   numeric(5,2),
  zoho_vendor_id  text,
  created_at      timestamptz not null default now()
);
create index idx_suppliers_org on suppliers(org_id);

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
create table purchase_orders (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  item_id         uuid not null references items(id),
  supplier_id     uuid references suppliers(id),
  quantity        int not null,
  unit_cost_inr   numeric(12,2),
  total_inr       numeric(14,2) generated always as (quantity * unit_cost_inr) stored,
  status          text not null default 'draft'
                    check (status in ('draft','pending','confirmed','shipped','received','overdue','cancelled')),
  created_by      uuid references users(id),
  zoho_po_id      text,
  expected_at     timestamptz,
  received_at     timestamptz,
  created_at      timestamptz not null default now()
);
-- High-use index: ops dashboard open PO queue
create index idx_po_org_status_date on purchase_orders(org_id, status, created_at desc);
create index idx_po_item            on purchase_orders(item_id);

-- ============================================================
-- NOTIFICATIONS  (zero-token rule engine, no LLM)
-- ============================================================
create table notifications (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid not null references organisations(id),
  item_id       uuid references items(id),
  user_id       uuid references users(id),
  trigger_type  text not null check (trigger_type in (
                  'low_stock','zero_stock','condition_flag','po_overdue',
                  'po_received','po_confirmed','iot_alert','whitelist_block')),
  title         text not null,
  body          text not null,
  channel       text not null check (channel in ('in_app','email','slack','push')),
  is_read       boolean not null default false,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);
-- Partial index: only unread rows — bell badge count fires on every page load
create index idx_notif_org_unread on notifications(org_id, created_at desc)
  where is_read = false;
create index idx_notif_user_unread on notifications(user_id, created_at desc)
  where is_read = false;

-- ============================================================
-- CONDITION FLAGS  (item not working)
-- ============================================================
create table condition_flags (
  id              uuid primary key default uuid_generate_v4(),
  item_id         uuid not null references items(id),
  org_id          uuid not null references organisations(id),
  raised_by       uuid references users(id),
  condition       text not null check (condition in ('damaged','expired','faulty','missing_parts','under_repair')),
  notes           text,
  resolved        boolean not null default false,
  resolved_by     uuid references users(id),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
-- Partial index: only open flags (chatbot: "what items are damaged?")
create index idx_flags_item_open on condition_flags(org_id, item_id)
  where resolved = false;

-- ============================================================
-- WHITELIST LOG  (every blocked attempt, auto-logged)
-- ============================================================
create table whitelist_log (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  attempted_sku   text not null,
  attempted_name  text,
  blocked_user    uuid references users(id),
  channel         text check (channel in ('ui','chatbot','api')),
  created_at      timestamptz not null default now()
);
create index idx_whitelist_log_org on whitelist_log(org_id, created_at desc);

-- ============================================================
-- AUDIT LOG  (immutable, archived after 90 days)
-- ============================================================
create table audit_log (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organisations(id),
  user_id     uuid references users(id),
  action      text not null,
  entity_type text,
  entity_id   uuid,
  payload     jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);
-- Deferred index — add when Phase 2 growth hits
-- create index idx_audit_org_date on audit_log(org_id, created_at desc);

-- ============================================================
-- REPORT CACHE  (TTL-based, keyed by org+filter_key)
-- ============================================================
create table report_cache (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  filter_key      text not null,
  format          text not null check (format in ('json','tsv','csv')),
  result          jsonb,
  row_count       int,
  generated_at    timestamptz not null default now(),
  expires_at      timestamptz not null,
  constraint uq_report_cache unique (org_id, filter_key)
);
create index idx_report_cache_org_key on report_cache(org_id, filter_key);
create index idx_report_cache_expiry  on report_cache(expires_at);

-- ============================================================
-- IOT DEVICES  (req 17)
-- ============================================================
create table iot_devices (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  device_id       text not null,
  device_type     text not null check (device_type in ('gateway','rfid','vibration','temperature','pressure')),
  client_name     text,
  location        text,
  firmware_ver    text,
  status          text not null default 'online' check (status in ('online','offline','alert','maintenance')),
  last_ping       timestamptz,
  last_reading    jsonb,
  item_id         uuid references items(id),
  created_at      timestamptz not null default now(),
  constraint uq_device_org unique (device_id, org_id)
);
create index idx_iot_org_status on iot_devices(org_id, status);

-- ============================================================
-- AMC (Annual Maintenance Contracts)  (req 17)
-- ============================================================
create table amc_contracts (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id),
  item_id         uuid not null references items(id),
  client_name     text not null,
  service_type    text not null check (service_type in ('comprehensive','basic','iot_maintenance','parts_only')),
  start_date      date not null,
  end_date        date not null,
  value_inr       numeric(12,2),
  next_service    date,
  status          text not null default 'active' check (status in ('active','expired','pending_renewal')),
  created_at      timestamptz not null default now()
);
create index idx_amc_org_status on amc_contracts(org_id, status);

-- ============================================================
-- ZOHO SYNC LOG
-- ============================================================
create table zoho_sync_log (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid not null references organisations(id),
  sync_type     text not null check (sync_type in ('items','stock','orders','vendors','full')),
  direction     text not null check (direction in ('push','pull','bidirectional')),
  records_synced int,
  status        text not null check (status in ('success','partial','failed')),
  error_msg     text,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz
);

-- ============================================================
-- MATERIALISED VIEW: live dashboard KPIs  (TTL 5 min via pg_cron)
-- ============================================================
create materialized view mv_stock_summary as
select
  i.org_id,
  count(*)                                          as total_skus,
  count(*) filter (where i.status = 'active')       as active_skus,
  count(*) filter (where i.status = 'quarantined')  as quarantined_skus,
  count(*) filter (where sl.balance_after <= i.reorder_point
                     and i.status = 'active')       as low_stock_count,
  count(*) filter (where sl.balance_after = 0
                     and i.status = 'active')       as zero_stock_count,
  sum(sl.balance_after * i.unit_cost_inr)           as stock_value_inr,
  now()                                             as refreshed_at
from items i
left join lateral (
  select balance_after
  from   stock_ledger
  where  item_id = i.id
  order  by created_at desc
  limit  1
) sl on true
group by i.org_id;

create unique index idx_mv_stock_summary_org on mv_stock_summary(org_id);

-- Refresh every 5 minutes
select cron.schedule('refresh-stock-summary', '*/5 * * * *',
  $$refresh materialized view concurrently mv_stock_summary$$);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
alter table organisations    enable row level security;
alter table users            enable row level security;
alter table items            enable row level security;
alter table stock_ledger     enable row level security;
alter table purchase_orders  enable row level security;
alter table notifications    enable row level security;
alter table condition_flags  enable row level security;
alter table whitelist_log    enable row level security;
alter table audit_log        enable row level security;
alter table iot_devices      enable row level security;
alter table amc_contracts    enable row level security;

-- Users see only their org
create policy "org isolation" on items
  using (org_id = (select org_id from users where id = auth.uid()));

create policy "org isolation" on stock_ledger
  using (org_id = (select org_id from users where id = auth.uid()));

create policy "org isolation" on purchase_orders
  using (org_id = (select org_id from users where id = auth.uid()));

-- Notifications: user sees own + unscoped org alerts
create policy "notif access" on notifications
  using (
    org_id = (select org_id from users where id = auth.uid())
    and (user_id = auth.uid() or user_id is null)
  );

-- ============================================================
-- ARCHIVE JOB: move audit_log rows older than 90 days to jsonl
-- (pg_cron triggers — actual export handled by Cloudflare Worker)
-- ============================================================
select cron.schedule('archive-audit-log', '0 2 * * *',
  $$
  delete from audit_log
  where created_at < now() - interval '90 days'
    and id in (
      select id from audit_log
      where created_at < now() - interval '90 days'
      limit 5000
    )
  $$
);

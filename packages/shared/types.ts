// packages/shared/types.ts
// Single source of truth for all VizAI data types

export type UserRole = 'super_admin' | 'manager' | 'ops' | 'user'
export type ItemStatus = 'active' | 'quarantined' | 'discontinued'
export type MovementType = 'in' | 'out' | 'adjustment' | 'zo_sync'
export type PoStatus = 'draft' | 'pending' | 'confirmed' | 'shipped' | 'received' | 'overdue' | 'cancelled'
export type TriggerType = 'low_stock' | 'zero_stock' | 'condition_flag' | 'po_overdue' | 'po_received' | 'po_confirmed' | 'iot_alert' | 'whitelist_block'
export type NotifChannel = 'in_app' | 'email' | 'slack' | 'push'
export type DeviceStatus = 'online' | 'offline' | 'alert' | 'maintenance'
export type DeviceType = 'gateway' | 'rfid' | 'vibration' | 'temperature' | 'pressure'
export type ReportFormat = 'json' | 'tsv' | 'csv'
export type ServiceType = 'comprehensive' | 'basic' | 'iot_maintenance' | 'parts_only'
export type ConditionType = 'damaged' | 'expired' | 'faulty' | 'missing_parts' | 'under_repair'

// ── Format routing decision ──────────────────────────────────
// Req 3: route response format based on data characteristics
export type FormatRouting = {
  format: ReportFormat
  reason: 'flat_counts' | 'nested_objects' | 'bulk_tabular' | 'binary_ref'
  estimated_tokens: number
}

export function decideFormat(rowCount: number, isNested: boolean, isBinary: boolean): FormatRouting {
  if (isBinary)    return { format: 'json', reason: 'binary_ref',     estimated_tokens: 20 }
  if (rowCount > 100 && !isNested)
                   return { format: 'csv',  reason: 'bulk_tabular',   estimated_tokens: Math.ceil(rowCount * 0.4) }
  if (!isNested)   return { format: 'tsv',  reason: 'flat_counts',    estimated_tokens: Math.ceil(rowCount * 0.6) }
                   return { format: 'json', reason: 'nested_objects', estimated_tokens: Math.ceil(rowCount * 2)   }
}

// ── Model routing decision ───────────────────────────────────
// Req 4: simple queries → Haiku, complex → Sonnet
export type QueryComplexity = 'simple' | 'complex'
export type ModelChoice = 'claude-haiku-4-5' | 'claude-sonnet-4-6'

const COMPLEX_PATTERNS = [
  /forecast/i, /anomal/i, /trend/i, /predict/i, /analys/i,
  /supplier.*negotiat/i, /why.*stock/i, /reason.*low/i,
  /compare.*supplier/i, /optimis/i, /recommend/i,
]

export function routeModel(query: string): { model: ModelChoice; complexity: QueryComplexity } {
  const isComplex = COMPLEX_PATTERNS.some(p => p.test(query))
  return isComplex
    ? { model: 'claude-sonnet-4-6', complexity: 'complex' }
    : { model: 'claude-haiku-4-5',  complexity: 'simple'  }
}

// ── MCP tool response envelope ───────────────────────────────
export interface McpResponse<T> {
  ok:     boolean
  data?:  T
  error?: string
  format: ReportFormat
  cached: boolean
  tokens_saved?: number
}

// ── Core domain types ────────────────────────────────────────
export interface Organisation {
  id:            string
  name:          string
  plan:          string
  product_limit: number
  zoho_org_id?:  string
  zoho_dc?:      string
}

export interface User {
  id:         string
  org_id:     string
  name:       string
  email:      string
  role:       UserRole
  is_active:  boolean
}

export interface Item {
  id:             string
  org_id:         string
  sku:            string
  name:           string
  category:       string
  unit:           string
  reorder_point:  number
  is_whitelisted: boolean
  status:         ItemStatus
  unit_cost_inr?: number
  zoho_item_id?:  string
  current_stock?: number   // populated by JOIN on stock_ledger
}

export interface StockLedgerEntry {
  id:              string
  item_id:         string
  org_id:          string
  quantity_change: number
  balance_after:   number
  movement_type:   MovementType
  reference_id?:   string
  raised_by?:      string
  created_at:      string
}

export interface PurchaseOrder {
  id:            string
  org_id:        string
  item_id:       string
  supplier_id?:  string
  quantity:      number
  unit_cost_inr?: number
  total_inr?:    number
  status:        PoStatus
  created_by?:   string
  zoho_po_id?:   string
  expected_at?:  string
  received_at?:  string
  created_at:    string
  item?:         Pick<Item, 'sku' | 'name' | 'category'>
  supplier?:     Pick<Supplier, 'name' | 'contact_email'>
}

export interface Supplier {
  id:              string
  org_id:          string
  name:            string
  contact_email?:  string
  avg_lead_days?:  number
  fill_rate_pct?:  number
  zoho_vendor_id?: string
}

export interface Notification {
  id:           string
  org_id:       string
  item_id?:     string
  user_id?:     string
  trigger_type: TriggerType
  title:        string
  body:         string
  channel:      NotifChannel
  is_read:      boolean
  metadata?:    Record<string, unknown>
  created_at:   string
}

export interface ConditionFlag {
  id:          string
  item_id:     string
  org_id:      string
  raised_by?:  string
  condition:   ConditionType
  notes?:      string
  resolved:    boolean
  created_at:  string
  resolved_at?: string
}

export interface IoTDevice {
  id:           string
  org_id:       string
  device_id:    string
  device_type:  DeviceType
  client_name?: string
  location?:    string
  firmware_ver?: string
  status:       DeviceStatus
  last_ping?:   string
  last_reading?: Record<string, unknown>
  item_id?:     string
}

export interface AmcContract {
  id:           string
  org_id:       string
  item_id:      string
  client_name:  string
  service_type: ServiceType
  start_date:   string
  end_date:     string
  value_inr?:   number
  next_service?: string
  status:       'active' | 'expired' | 'pending_renewal'
}

// ── Dashboard KPI shape (from materialized view) ─────────────
export interface StockSummaryKpi {
  org_id:          string
  total_skus:      number
  active_skus:     number
  quarantined_skus: number
  low_stock_count: number
  zero_stock_count: number
  stock_value_inr: number
  refreshed_at:    string
}

// ── HashMap cache entry (req 16) ─────────────────────────────
export interface HashMapEntry {
  sku:        string
  item_id:    string
  name:       string
  stock:      number
  bucket:     number
  chain_pos:  number
  hits:       number
  inserted_at: number
}

// ── Zoho sync types ──────────────────────────────────────────
export interface ZohoItemPayload {
  item_id:        string
  name:           string
  sku:            string
  rate:           number
  unit:           string
  stock_on_hand:  number
  reorder_point:  number
  vendor_id?:     string
}

export interface ZohoSyncResult {
  synced:  number
  skipped: number
  errors:  number
  details: string[]
}

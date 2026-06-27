// infra/supabase/seed/index.ts
// VizAI Engineering — real product seed data
// Clients: Ashok Leyland, TVS Motors, Hyundai India, Foxconn Chennai

// Suppress missing module/type errors in environments where the package
// isn't installed (CI/local dev). The runtime should still provide the
// package when executing the seed script.
// @ts-ignore: Suppress "Cannot find module '@supabase/supabase-js'" during typechecking
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

const ORG_ID = "vizai-org-001";

const ITEMS = [
  // Forklifts
  {
    sku: "VZ-FLT-001",
    name: "Electric Forklift 3T",
    category: "Forklifts",
    unit: "unit",
    reorder_point: 2,
    unit_cost_inr: 1850000,
  },
  {
    sku: "VZ-FLT-002",
    name: "Electric Forklift 5T",
    category: "Forklifts",
    unit: "unit",
    reorder_point: 1,
    unit_cost_inr: 2400000,
  },
  // Pallet Trucks
  {
    sku: "VZ-PLT-011",
    name: "Pallet Truck 2T",
    category: "Pallet Trucks",
    unit: "unit",
    reorder_point: 3,
    unit_cost_inr: 120000,
  },
  {
    sku: "VZ-PLT-012",
    name: "Pallet Truck 1.5T",
    category: "Pallet Trucks",
    unit: "unit",
    reorder_point: 3,
    unit_cost_inr: 95000,
  },
  // Stackers
  {
    sku: "VZ-STK-021",
    name: "Reach Stacker 1.6T",
    category: "Stackers",
    unit: "unit",
    reorder_point: 2,
    unit_cost_inr: 480000,
  },
  {
    sku: "VZ-STK-022",
    name: "Walkie Stacker 1T",
    category: "Stackers",
    unit: "unit",
    reorder_point: 2,
    unit_cost_inr: 280000,
  },
  // Scissor Lifts
  {
    sku: "VZ-SCL-031",
    name: "Scissor Lift 500kg",
    category: "Scissor Lifts",
    unit: "unit",
    reorder_point: 1,
    unit_cost_inr: 620000,
  },
  {
    sku: "VZ-SCL-032",
    name: "Scissor Lift 1000kg",
    category: "Scissor Lifts",
    unit: "unit",
    reorder_point: 1,
    unit_cost_inr: 980000,
  },
  // IoT Devices
  {
    sku: "VZ-IOT-041",
    name: "IoT Gateway Module",
    category: "IoT Devices",
    unit: "unit",
    reorder_point: 5,
    unit_cost_inr: 45000,
  },
  {
    sku: "VZ-RFD-051",
    name: "RFID Reader 900MHz",
    category: "IoT Devices",
    unit: "unit",
    reorder_point: 4,
    unit_cost_inr: 28000,
  },
  {
    sku: "VZ-VIB-061",
    name: "Vibration Sensor",
    category: "IoT Devices",
    unit: "unit",
    reorder_point: 5,
    unit_cost_inr: 8500,
  },
  {
    sku: "VZ-TMP-071",
    name: "Temperature Sensor",
    category: "IoT Devices",
    unit: "unit",
    reorder_point: 5,
    unit_cost_inr: 6500,
  },
  // Spare Parts
  {
    sku: "VZ-SPA-044",
    name: "Drive Motor 15kW",
    category: "Spare Parts",
    unit: "unit",
    reorder_point: 3,
    unit_cost_inr: 95000,
  },
  {
    sku: "VZ-SPA-055",
    name: "Hydraulic Cylinder",
    category: "Spare Parts",
    unit: "unit",
    reorder_point: 3,
    unit_cost_inr: 42000,
  },
  {
    sku: "VZ-SPA-066",
    name: "Control Board PCB",
    category: "Spare Parts",
    unit: "unit",
    reorder_point: 4,
    unit_cost_inr: 18000,
  },
  {
    sku: "VZ-SPA-077",
    name: "Lithium Battery Pack 48V",
    category: "Spare Parts",
    unit: "unit",
    reorder_point: 2,
    unit_cost_inr: 145000,
  },
];

const SUPPLIERS = [
  {
    name: "Godrej Material Handling",
    contact_email: "orders@godrej-mh.com",
    avg_lead_days: 7,
    fill_rate_pct: 96,
  },
  {
    name: "ABB India Ltd",
    contact_email: "supply@abb.in",
    avg_lead_days: 10,
    fill_rate_pct: 88,
  },
  {
    name: "Parker Hannifin India",
    contact_email: "procurement@parker.co.in",
    avg_lead_days: 14,
    fill_rate_pct: 72,
  },
  {
    name: "Honeywell India Sensing",
    contact_email: "orders@honeywell.in",
    avg_lead_days: 8,
    fill_rate_pct: 94,
  },
  {
    name: "Zebra Technologies India",
    contact_email: "sales@zebra.co.in",
    avg_lead_days: 6,
    fill_rate_pct: 85,
  },
  {
    name: "Voltas Limited",
    contact_email: "equipment@voltas.in",
    avg_lead_days: 5,
    fill_rate_pct: 91,
  },
];

const IOT_DEVICES = [
  {
    device_id: "IOT-AL-001",
    device_type: "gateway",
    client_name: "Ashok Leyland",
    location: "Medavakkam Warehouse Bay A",
    status: "online",
  },
  {
    device_id: "IOT-AL-002",
    device_type: "gateway",
    client_name: "Ashok Leyland",
    location: "Medavakkam Warehouse Bay B",
    status: "online",
  },
  {
    device_id: "IOT-HY-003",
    device_type: "vibration",
    client_name: "Hyundai India",
    location: "VGP Pushpa Nagar Warehouse",
    status: "alert",
  },
  {
    device_id: "IOT-TV-004",
    device_type: "rfid",
    client_name: "TVS Motors",
    location: "Medavakkam Warehouse Gate",
    status: "online",
  },
  {
    device_id: "IOT-FX-005",
    device_type: "gateway",
    client_name: "Foxconn Chennai",
    location: "Sholinganallur Industrial Park",
    status: "online",
  },
  {
    device_id: "IOT-AL-006",
    device_type: "rfid",
    client_name: "Ashok Leyland",
    location: "Medavakkam Warehouse Bay C",
    status: "online",
  },
  {
    device_id: "IOT-TV-007",
    device_type: "vibration",
    client_name: "TVS Motors",
    location: "Ambattur Industrial Estate",
    status: "offline",
  },
  {
    device_id: "IOT-HY-008",
    device_type: "gateway",
    client_name: "Hyundai India",
    location: "SIPCOT Irungattukottai",
    status: "offline",
  },
];

async function seed() {
  console.log("Seeding VizAI data...");

  // Org
  await sb.from("organisations").upsert({
    id: ORG_ID,
    name: "VizAI Engineering",
    plan: "pro",
    product_limit: 1000,
  });

  // Items (all whitelisted by default — req 11)
  const { data: items, error: itemErr } = await sb
    .from("items")
    .upsert(
      ITEMS.map((i) => ({
        ...i,
        org_id: ORG_ID,
        is_whitelisted: true,
        status: "active",
      })),
    )
    .select("id, sku");
  if (itemErr) {
    console.error("Items:", itemErr);
    return;
  }
  console.log(`Seeded ${items?.length} items`);

  // Suppliers
  const { data: suppliers } = await sb
    .from("suppliers")
    .upsert(SUPPLIERS.map((s) => ({ ...s, org_id: ORG_ID })))
    .select("id");
  console.log(`Seeded ${suppliers?.length} suppliers`);

  // Initial stock levels via ledger
  if (items) {
    const INITIAL_STOCK: Record<string, number> = {
      "VZ-FLT-001": 4,
      "VZ-FLT-002": 2,
      "VZ-PLT-011": 8,
      "VZ-PLT-012": 5,
      "VZ-STK-021": 1,
      "VZ-STK-022": 3,
      "VZ-SCL-031": 3,
      "VZ-SCL-032": 2,
      "VZ-IOT-041": 12,
      "VZ-RFD-051": 7,
      "VZ-VIB-061": 0,
      "VZ-TMP-071": 6,
      "VZ-SPA-044": 5,
      "VZ-SPA-055": 2,
      "VZ-SPA-066": 8,
      "VZ-SPA-077": 3,
    };
    for (const item of items) {
      const qty = INITIAL_STOCK[item.sku] ?? 0;
      await sb.from("stock_ledger").insert({
        item_id: item.id,
        org_id: ORG_ID,
        quantity_change: qty,
        balance_after: qty,
        movement_type: "in",
        reference_id: "SEED",
      });
    }
    console.log("Seeded initial stock levels");
  }

  // IoT devices
  await sb
    .from("iot_devices")
    .upsert(IOT_DEVICES.map((d) => ({ ...d, org_id: ORG_ID })));
  console.log(`Seeded ${IOT_DEVICES.length} IoT devices`);

  console.log("Seed complete.");
}

seed().catch(console.error);

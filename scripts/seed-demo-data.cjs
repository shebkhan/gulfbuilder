/**
 * Demo data seeder for the Gulf Property platform.
 *
 * Buildings come from live propertyfinder.qa rental listings (Qatar), with the
 * advertised rent, size and location:
 *   https://www.propertyfinder.qa/en/rent/properties-for-rent.html
 * Everything else is generated around them: floors, units, tenants, leases,
 * charges, payments, cheques, deposits, expenses, maintenance, inspections,
 * meters, ledger entries, owner statements and payouts.
 *
 *   node scripts/seed-demo-data.cjs            # seed
 *   node scripts/seed-demo-data.cjs --reset    # wipe the seeded rows first
 *
 * Demo logins it creates (passwords are for local development only):
 *   tenant@example.com / Tenant1234!   tenant portal
 *   owner@example.com  / Owner1234!    owner portal
 *   admin@example.com  / Admin1234!    staff workspace
 */
const { createClient } = require("@supabase/supabase-js");
const fs = require("node:fs");

const ORG_ID = "63396bf2-9505-44bc-852c-af5c659f47c1";
const ORG_SLUG = "citadel";
const CURRENCY = "QAR";

function env(name) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key?.trim() === name) return rest.join("=").trim();
  }
  throw new Error(`missing ${name}`);
}

const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── deterministic random ──────────────────────────────────────────────────────
let seed = 20261116;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = (list) => list[Math.floor(rnd() * list.length)];
const between = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const chance = (p) => rnd() < p;

const TODAY = new Date();
const iso = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
const addMonths = (date, months) => {
  const copy = new Date(date.getTime());
  copy.setMonth(copy.getMonth() + months);
  return copy;
};
const monthStart = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
/** Month arithmetic without the setMonth overflow (Jan 31 + 1 month must stay in February). */
const addMonthsSafe = (date, months) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
/** Same month, day clamped to the length of the target month (lease end dates). */
const addMonthsClamped = (date, months) => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
};

// ── catalogue: real listings from propertyfinder.qa ──────────────────────────
const PROPERTIES = [
  {
    code: "LSR",
    name: "Lusail Residence",
    zone: "Marina District",
    street: "Lusail Marina",
    city: "Lusail",
    value: 85_000_000_00,
    floors: 6,
    perFloor: 8,
    amenities: ["swimming pool", "gym", "covered parking", "security"],
    units: [
      { type: "1br", rent: 7_846_00, bedrooms: 1, bathrooms: 1, area: 100, occupancy: "family" },
      { type: "2br", rent: 9_250_00, bedrooms: 2, bathrooms: 2, area: 150, occupancy: "family" },
      { type: "3br", rent: 11_571_00, bedrooms: 3, bathrooms: 3, area: 220, occupancy: "family" },
    ],
  },
  {
    code: "GIA",
    name: "Giardino Apartments",
    zone: "The Pearl Island",
    street: "Qanat Quartier",
    city: "Doha",
    value: 62_000_000_00,
    floors: 5,
    perFloor: 6,
    amenities: ["swimming pool", "sea view", "gym", "concierge"],
    units: [
      { type: "2br", rent: 10_000_00, bedrooms: 2, bathrooms: 3, area: 140, occupancy: "family", furnished: true },
    ],
  },
  {
    code: "WPD",
    name: "Porto Arabia Residences",
    zone: "The Pearl Island",
    street: "West Porto Drive",
    city: "Doha",
    value: 78_000_000_00,
    floors: 5,
    perFloor: 6,
    amenities: ["marina", "gym", "kids area", "covered parking"],
    units: [
      { type: "1br", rent: 8_500_00, bedrooms: 1, bathrooms: 2, area: 148, occupancy: "family", furnished: true },
      { type: "3br", rent: 16_000_00, bedrooms: 3, bathrooms: 4, area: 265, occupancy: "family" },
    ],
  },
  {
    code: "BZC",
    name: "Barzan Compound",
    zone: "New Salata",
    street: "Barzan Street",
    city: "Doha",
    value: 41_000_000_00,
    floors: 4,
    perFloor: 6,
    amenities: ["shared pool", "playground", "shops"],
    units: [
      { type: "studio", rent: 3_200_00, bedrooms: 0, bathrooms: 1, area: 50, occupancy: "bachelor" },
      { type: "1br", rent: 4_615_00, bedrooms: 1, bathrooms: 1, area: 70, occupancy: "bachelor" },
    ],
  },
  {
    code: "OAR",
    name: "Old Airport Residential Apartments",
    zone: "Old Airport Road",
    street: "Old Airport 43",
    city: "Doha",
    value: 54_000_000_00,
    floors: 4,
    perFloor: 8,
    amenities: ["shops", "covered parking", "security"],
    units: [
      { type: "2br", rent: 4_615_00, bedrooms: 2, bathrooms: 2, area: 80, occupancy: "family" },
      { type: "3br", rent: 8_769_00, bedrooms: 3, bathrooms: 3, area: 117, occupancy: "family", furnished: true },
    ],
  },
  {
    code: "ATB",
    name: "Al Tabari Apartments",
    zone: "Fereej Bin Omran",
    street: "Al Tabari Street",
    city: "Doha",
    value: 48_000_000_00,
    floors: 4,
    perFloor: 6,
    amenities: ["gym", "shops", "parking"],
    units: [
      { type: "2br", rent: 4_615_00, bedrooms: 2, bathrooms: 2, area: 82, occupancy: "family", furnished: true },
    ],
  },
  {
    code: "RCB",
    name: "Ramada Commercial Building",
    zone: "Al Muntazah",
    street: "Al Rawabi Street",
    city: "Doha",
    value: 39_000_000_00,
    floors: 4,
    perFloor: 6,
    amenities: ["shops", "lift", "parking"],
    units: [
      { type: "office", rent: 8_769_00, bedrooms: 0, bathrooms: 2, area: 90, occupancy: "commercial" },
      { type: "2br", rent: 8_769_00, bedrooms: 2, bathrooms: 2, area: 117, occupancy: "family", furnished: true },
    ],
  },
  {
    code: "STV",
    name: "Star Villas",
    zone: "Muaither South",
    street: "Muaither Area",
    city: "Doha",
    value: 95_000_000_00,
    floors: 2,
    perFloor: 4,
    amenities: ["private garden", "maid room", "swimming pool", "covered parking"],
    units: [
      { type: "villa", rent: 12_000_00, bedrooms: 3, bathrooms: 4, area: 194, occupancy: "family", furnished: true },
    ],
  },
  {
    code: "VIV",
    name: "Viva West",
    zone: "Viva Bahriyah",
    street: "Viva Bahriyah",
    city: "Doha",
    value: 52_000_000_00,
    floors: 4,
    perFloor: 8,
    amenities: ["sea view", "gym", "covered parking", "concierge"],
    units: [
      { type: "1br", rent: 9_520_00, bedrooms: 1, bathrooms: 2, area: 126, occupancy: "family", furnished: true },
    ],
  },
  {
    code: "LVG",
    name: "Les Vagues by Elie Saab",
    zone: "Qetaifan Islands",
    street: "Qetaifan Islands North",
    city: "Lusail",
    value: 96_000_000_00,
    floors: 5,
    perFloor: 4,
    amenities: ["sea view", "private garden", "gym", "kids area"],
    units: [
      { type: "3br", rent: 20_000_00, bedrooms: 3, bathrooms: 4, area: 232, occupancy: "family", furnished: true },
    ],
  },
  {
    code: "EWN",
    name: "Ewan Garden",
    zone: "West Bay Lagoon",
    street: "Ewan Garden",
    city: "Doha",
    value: 120_000_000_00,
    floors: 2,
    perFloor: 4,
    amenities: ["private garden", "swimming pool", "maid room", "covered parking"],
    units: [
      { type: "villa", rent: 21_000_00, bedrooms: 5, bathrooms: 6, area: 500, occupancy: "family", furnished: true },
    ],
  },
  {
    code: "AMT",
    name: "Al Mutahidah Tower",
    zone: "Viva Bahriyah",
    street: "Al Mutahidah Tower",
    city: "Doha",
    value: 58_000_000_00,
    floors: 4,
    perFloor: 8,
    amenities: ["sea view", "gym", "security", "covered parking"],
    units: [
      { type: "studio", rent: 7_000_00, bedrooms: 0, bathrooms: 1, area: 85, occupancy: "bachelor" },
    ],
  },
];

const ARABIC_TENANTS = [
  "محمد الأحمد", "فاطمة الديب", "عبدالله الكواري", "مريم العلي", "خالد الثاني", "سارة المنصور",
  "أحمد الزعابي", "هند القاسمي", "يوسف السليطي", "ريم الدوسري", "طلال المري", "نورة الكواري",
  "عمر البلوشي", "لمياء العبدالله", "بدر الخالدي", "دانة الريامي", "محسن الحداد", "جواهر السادة",
  "جاسم الدرويش", "غادة الأنصاري", "إبراهيم المناعي", "شهد الكواري", "ماجد الصعايد", "أسماء الحداد",
  "راشد النعيمي", "وفاء المري", "حمد المPTY", "ناصر الكعبي", "شهد الحمادي", "مازن الشامي",
];

const ENGLISH_TENANTS = [
  "James Whitfield", "Sarah Lindqvist", "Mohammed Rahman", "Priya Nair", "Daniel Okoro", "Aisha Bello",
  "Thomas Berger", "Elena Petrova", "Rajesh Menon", "Hannah Cole", "Omar Haddad", "Lucy Bennett",
  "Ahmed Farouk", "Clara Silva", "Vikram Shetty", "Nadia Zaman", "Peter Novak", "Grace Mwangi",
  "Faisal Al Nuaimi", "Laura Schmidt", "Imran Qureshi", "Rachel Doyle", "Karim Mansour", "Anna Kowalska",
  "Michael Osei", "Yara Suleiman", "Stefan Horvat", "Leila Bouzid", "Tomas Varga", "Mariam Sesay",
];

const VENDORS = [
  { name: "Doha Cooling Systems", trade: "HVAC" },
  { name: "Qatar Elevator Care", trade: "Lifts" },
  { name: "Blue Horizon Plumbing", trade: "Plumbing" },
  { name: "Pearl Electricals", trade: "Electrical" },
  { name: "Gulf Cleaning Services", trade: "Cleaning" },
  { name: "Al Jazeera Security", trade: "Security" },
  { name: "Star Gate Maintenance", trade: "General" },
];

const MAINTENANCE_TITLES = [
  ["Air conditioning not cooling", "air_conditioning", "high"],
  ["Water leak under kitchen sink", "plumbing", "high"],
  ["Lift stuck between floors 3 and 4", "general", "urgent"],
  ["Bedroom light fitting flickering", "electrical", "normal"],
  ["Bathroom extractor fan noisy", "electrical", "low"],
  ["Balcony door lock broken", "general", "normal"],
  ["Hot water not working", "plumbing", "high"],
  ["Intercom panel not working", "electrical", "low"],
  ["Painted corridor needs repainting", "general", "low"],
  ["Pool pump making noise", "general", "normal"],
];

const EXPENSE_TITLES = [
  ["Lift maintenance contract", "Maintenance and Repairs"],
  ["Chiller servicing", "Maintenance and Repairs"],
  ["Electricity - DEWA style bulk bill", "Utilities"],
  ["Water - bulk supply", "Utilities"],
  ["Building insurance premium", "Insurance"],
  ["Security guard wages", "General and Administrative"],
  ["Common area cleaning", "General and Administrative"],
  ["Generator fuel", "Utilities"],
  ["Landscaping and gardening", "General and Administrative"],
  ["Repainting of service corridors", "Maintenance and Repairs"],
];

const METHODS = ["cash", "bank_transfer", "cheque", "online"];
const BANKS = ["Qatar National Bank", "Mashreq Bank", "Commercial Bank Qatar", "Bank of Doha"];

/** Splits ids into request-sized batches: a long id list overflows the request URL. */
function chunks(ids, size = 50) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** Deletes by id list in batches and fails loudly — a silent skip strands foreign keys. */
async function deleteIn(table, column, ids, filter) {
  for (const batch of chunks(ids)) {
    let query = db.from(table).delete().in(column, batch);
    if (filter) query = query.eq(filter.column, filter.value);
    const { error } = await query;
    if (error) throw new Error(`${table}.${column}: ${error.message}`);
  }
}

async function wipe() {
  console.log("reset: removing the rows this seed created");
  const codes = PROPERTIES.map((p) => p.code);

  const { data: seededBuildings } = await db
    .from("buildings")
    .select("id")
    .eq("org_id", ORG_ID)
    .in("code", codes);
  const buildingIds = (seededBuildings ?? []).map((b) => b.id);
  if (buildingIds.length === 0) return;

  const { data: seededUnits } = await db.from("units").select("id").in("building_id", buildingIds);
  const unitIds = (seededUnits ?? []).map((u) => u.id);
  const { data: seededFloors } = await db.from("floors").select("id").in("building_id", buildingIds);
  const floorIds = (seededFloors ?? []).map((f) => f.id);
  const { data: seededLeases } = await db.from("leases").select("id").in("unit_id", unitIds);
  const leaseIds = (seededLeases ?? []).map((l) => l.id);
  const { data: seededMeters } = await db.from("meters").select("id").in("building_id", buildingIds);
  const meterIds = (seededMeters ?? []).map((m) => m.id);
  const { data: seededRequests } = await db
    .from("maintenance_requests")
    .select("id")
    .in("building_id", buildingIds);
  const requestIds = (seededRequests ?? []).map((r) => r.id);
  const { data: seededPayments } = await db.from("payments").select("id").in("lease_id", leaseIds);
  const paymentIds = (seededPayments ?? []).map((p) => p.id);
  const { data: seededOwners } = await db
    .from("owners")
    .select("id")
    .eq("org_id", ORG_ID)
    .in("name", ["Al Manar Holding", "Gulf Horizon LLC"]);
  const ownerIds = (seededOwners ?? []).map((o) => o.id);

  await deleteIn("payment_allocations", "payment_id", paymentIds);
  await deleteIn("payments", "lease_id", leaseIds);
  await deleteIn("charges", "lease_id", leaseIds);
  await deleteIn("cheques", "lease_id", leaseIds);
  await deleteIn("inspections", "lease_id", leaseIds);
  await deleteIn("documents", "entity_id", leaseIds, { column: "entity_type", value: "lease" });

  const { data: seededDeposits } = leaseIds.length
    ? await db.from("deposits").select("id").in("lease_id", leaseIds)
    : { data: [] };
  const depositIds = (seededDeposits ?? []).map((d) => d.id);
  await deleteIn("deposit_transactions", "deposit_id", depositIds);
  await deleteIn("deposits", "id", depositIds);

  // Ledger: journals are immutable, so the sanctioned reset clears them first.
  const { error: ledgerError } = await db.rpc("demo_reset_ledger", { p_org: ORG_ID });
  if (ledgerError) throw new Error(`demo_reset_ledger: ${ledgerError.message}`);

  await deleteIn("owner_ledger_entries", "building_id", buildingIds);
  await deleteIn("expenses", "building_id", buildingIds);
  await deleteIn("meter_readings", "meter_id", meterIds);
  await deleteIn("meters", "id", meterIds);
  await deleteIn("maintenance_events", "request_id", requestIds);
  await deleteIn("maintenance_requests", "id", requestIds);
  await deleteIn("owner_expense_approvals", "owner_id", ownerIds);
  await deleteIn("owner_statements", "owner_id", ownerIds);
  await deleteIn("owner_payouts", "owner_id", ownerIds);

  await deleteIn("leases", "id", leaseIds);
  await deleteIn("units", "id", unitIds);
  await deleteIn("floors", "id", floorIds);
  await deleteIn("buildings", "id", buildingIds);

  await db.from("tenants").delete().eq("org_id", ORG_ID).like("email", "tenant.%@example.com");
  await deleteIn("owners", "id", ownerIds);

  await db.from("vendors").delete().eq("org_id", ORG_ID);
  await db.from("bank_accounts").delete().eq("org_id", ORG_ID);
  await db.from("accounting_periods").delete().eq("org_id", ORG_ID);
  await db.from("notification_templates").delete().eq("org_id", ORG_ID);
  await db.from("notification_outbox").delete().eq("org_id", ORG_ID);
  await db.from("usage_snapshots").delete().eq("org_id", ORG_ID);
}

async function chunkInsert(table, rows) {
  if (rows.length === 0) return [];
  const inserted = [];
  for (let i = 0; i < rows.length; i += 400) {
    const { data, error } = await db.from(table).insert(rows.slice(i, i + 400)).select();
    if (error) throw new Error(`${table}: ${error.message}`);
    if (data) inserted.push(...data);
  }
  return inserted;
}

async function ensureUser(email, password, fullName, role, locale = "en") {
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { full_name: fullName },
  });
  let userId = created?.user?.id;
  if (!userId) {
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  }
  if (!userId) throw new Error(`could not create ${email}: ${error?.message}`);

  await db.from("profiles").upsert({ id: userId, full_name: fullName, locale, active_org_id: ORG_ID });
  await db.from("org_members").upsert({ org_id: ORG_ID, user_id: userId, role });
  return userId;
}

async function main() {
  const reset = process.argv.includes("--reset");

  const { data: already } = await db
    .from("buildings")
    .select("id")
    .eq("org_id", ORG_ID)
    .eq("code", "LSR")
    .maybeSingle();
  if (already && !reset) {
    console.log("already seeded — run with --reset to rebuild");
    return;
  }
  if (reset) await wipe();

  // ── owners ──────────────────────────────────────────────────────────────────
  const { data: selfOwner } = await db
    .from("owners")
    .select("id")
    .eq("org_id", ORG_ID)
    .eq("is_company_self", true)
    .maybeSingle();

  const ownerRows = [
    {
      org_id: ORG_ID,
      name: "Al Manar Holding",
      ownership_model: "managed",
      fee_type: "percent_of_collections",
      fee_value: 5,
      contact: { email: "owner@example.com", phone: "+974 4400 1122" },
      payout_frequency: "monthly",
      approval_threshold_minor: 2_000_00,
    },
    {
      org_id: ORG_ID,
      name: "Gulf Horizon LLC",
      ownership_model: "managed",
      fee_type: "fixed_per_unit",
      fee_value: 250_00,
      contact: { email: "horizon@example.com", phone: "+974 3311 8899" },
      payout_frequency: "monthly",
      approval_threshold_minor: 5_000_00,
    },
  ];
  const { data: owners, error: ownerError } = await db.from("owners").insert(ownerRows).select();
  if (ownerError) throw ownerError;
  const [manar, horizon] = owners;

  // ── logins ──────────────────────────────────────────────────────────────────
  const adminUserId = await ensureUser("admin@example.com", "Admin1234!", "Citadel Admin", "org_admin");
  const ownerUserId = await ensureUser("owner@example.com", "Owner1234!", "Al Manar Holding", "owner");
  await db.from("platform_admins").upsert({ user_id: adminUserId });
  await db.from("owners").update({ user_id: ownerUserId }).eq("id", manar.id);

  const tenantUserIds = [];
  for (let i = 0; i < 3; i += 1) {
    tenantUserIds.push(
      await ensureUser(
        `tenant${i + 1}@example.com`,
        "Tenant1234!",
        i === 0 ? "Demo Tenant" : `Demo Tenant ${i + 1}`,
        "tenant",
        i === 1 ? "ar" : "en",
      ),
    );
  }
  // The demo tenant created earlier keeps its own login.
  const { data: existingDemo } = await db
    .from("tenants")
    .select("user_id")
    .eq("org_id", ORG_ID)
    .not("user_id", "is", null)
    .limit(1)
    .maybeSingle();

  // ── buildings, floors, units ───────────────────────────────────────────────
  const buildingRows = PROPERTIES.map((p, index) => ({
    org_id: ORG_ID,
    owner_id: index < 3 ? manar.id : index < 6 ? horizon.id : selfOwner.id,
    code: p.code,
    name: p.name,
    country_code: "QA",
    city: p.city,
    zone: p.zone,
    street: p.street,
    building_no: String(100 + index),
    national_address: { area: p.zone, street: p.street, block: String(10 + index) },
    latitude: 25.29 + index * 0.01,
    longitude: 51.51 + index * 0.01,
    amenities: p.amenities,
    property_value_minor: p.value,
  }));
  const { data: buildings, error: buildingError } = await db.from("buildings").insert(buildingRows).select();
  if (buildingError) throw buildingError;

  const floorRows = [];
  for (const [index, building] of buildings.entries()) {
    const property = PROPERTIES[index];
    for (let level = 0; level <= property.floors; level += 1) {
      floorRows.push({
        org_id: ORG_ID,
        building_id: building.id,
        level,
        label: level === 0 ? "Ground" : `Floor ${level}`,
      });
    }
  }
  const { data: floors } = await db.from("floors").insert(floorRows).select();

  const unitRows = [];
  for (const [index, building] of buildings.entries()) {
    const property = PROPERTIES[index];
    const propertyFloors = floors.filter((f) => f.building_id === building.id);
    for (const floor of propertyFloors) {
      for (let slot = 1; slot <= property.perFloor; slot += 1) {
        const template = property.units[(floor.level + slot) % property.units.length];
        const floorPremium = 1 + (floor.level * 0.03);
        unitRows.push({
          org_id: ORG_ID,
          building_id: building.id,
          floor_id: floor.id,
          unit_no: `${floor.level}0${slot}`,
          unit_type: template.type,
          occupancy_type: template.occupancy,
          bedrooms: template.bedrooms,
          bathrooms: template.bathrooms,
          area_sqm: template.area,
          furnished: Boolean(template.furnished),
          rentable_as: "whole",
          default_rent_minor: Math.round(template.rent * floorPremium),
          currency: CURRENCY,
          status: "vacant",
        });
      }
    }
  }
  const { data: units, error: unitError } = await db.from("units").insert(unitRows).select();
  if (unitError) throw unitError;
  console.log(`buildings ${buildings.length}, floors ${floors.length}, units ${units.length}`);

  // ── tenants ─────────────────────────────────────────────────────────────────
  const tenantRows = [];
  const names = [...ARABIC_TENANTS, ...ENGLISH_TENANTS];
  names.forEach((fullName, index) => {
    const isArabic = index < ARABIC_TENANTS.length;
    tenantRows.push({
      org_id: ORG_ID,
      full_name: fullName,
      kind: "person",
      language: isArabic ? "ar" : "en",
      phone: `+974 3${between(100, 999)} ${between(1000, 9999)}`,
      whatsapp: chance(0.6) ? `+974 5${between(100, 999)} ${between(1000, 9999)}` : null,
      email: `tenant.${index + 1}@example.com`,
      nationality: isArabic ? "Qatari" : pick(["Indian", "British", "Egyptian", "Filipino", "British", "Jordanian"]),
      employer: pick(["Qatar Airways", "Al Jazeera", "QNB", "Microsoft Qatar", "Ooredoo", "HBJ"]),
      id_expiry: chance(0.25) ? iso(addDays(TODAY, between(-10, 120))) : null,
    });
  });
  const { data: tenants, error: tenantError } = await db.from("tenants").insert(tenantRows).select();
  if (tenantError) throw tenantError;

  // Link the demo logins to three tenants.
  const demoTenants = [];
  for (const [index, userId] of tenantUserIds.entries()) {
    const tenant = tenants[index];
    if (!tenant) continue;
    await db.from("tenants").update({ user_id: userId, email: `tenant${index + 1}@example.com` }).eq("id", tenant.id);
    demoTenants.push({ ...tenant, user_id: userId });
  }
  console.log(`tenants ${tenants.length}`);

  // ── leases ──────────────────────────────────────────────────────────────────
  const { data: existingLeases } = await db
    .from("leases")
    .select("unit_id, status")
    .eq("org_id", ORG_ID)
    .eq("status", "active");
  const takenUnitIds = new Set((existingLeases ?? []).map((l) => l.unit_id).filter(Boolean));

  const leaseRows = [];
  units.forEach((unit, index) => {
    if (takenUnitIds.has(unit.id)) return; // already leased outside this seed
    if (chance(0.24)) return; // vacant units
    const tenant = tenants[index % tenants.length];
    const start = chance(0.25) ? addDays(TODAY, -between(5, 70)) : addDays(TODAY, -between(90, 430));
    const term = chance(0.8) ? 12 : 24;
    const quarterly = chance(0.15);
    const status = chance(0.04) ? "draft" : chance(0.04) ? "expired" : "active";
    leaseRows.push({
      org_id: ORG_ID,
      lease_no: `${unit.building_id.slice(0, 4)}-${unit.unit_no}-${String(index + 1).padStart(4, "0")}`,
      unit_id: unit.id,
      tenant_id: tenant.id,
      start_date: iso(start),
      end_date: iso(addMonthsClamped(start, term)),
      rent_minor: unit.default_rent_minor,
      currency: CURRENCY,
      payment_frequency: quarterly ? "quarterly" : "monthly",
      installments: quarterly ? 4 : 12,
      due_day: chance(0.7) ? 1 : 5,
      deposit_minor: chance(0.85) ? unit.default_rent_minor * (chance(0.5) ? 1 : 2) : 0,
      rent_collected_by: "landlord",
      status,
      notice_days: 60,
    });
  });
  const { data: leases, error: leaseError } = await db.from("leases").insert(leaseRows).select();
  if (leaseError) throw leaseError;
  console.log(`leases ${leases.length}`);

  // ── charges, payments, allocations ─────────────────────────────────────────
  const chargeRows = [];
  for (const lease of leases) {
    if (lease.status !== "active") continue;
    const start = new Date(lease.start_date);
    const step = lease.payment_frequency === "quarterly" ? 3 : 1;
    const periodAmount = lease.rent_minor * step;
    for (let period = 0; ; period += 1) {
      const periodStart = monthStart(addMonthsSafe(start, period * step));
      if (periodStart > TODAY) break;
      const dueDate = new Date(periodStart);
      dueDate.setUTCDate(lease.due_day);
      const overdue = dueDate < addDays(TODAY, -7);
      const status = overdue && chance(0.35) ? "overdue" : chance(0.12) ? "pending" : "paid";
      chargeRows.push({
        org_id: ORG_ID,
        lease_id: lease.id,
        type: "rent",
        description: "Rent",
        period_start: iso(periodStart),
        due_date: iso(dueDate),
        amount_minor: periodAmount,
        currency: CURRENCY,
        paid_minor: status === "paid" ? periodAmount : 0,
        status,
      });
    }
    if (lease.deposit_minor > 0) {
      chargeRows.push({
        org_id: ORG_ID,
        lease_id: lease.id,
        type: "deposit",
        description: "Security deposit",
        period_start: iso(start),
        due_date: iso(start),
        amount_minor: lease.deposit_minor,
        currency: CURRENCY,
        paid_minor: chance(0.9) ? lease.deposit_minor : 0,
        status: chance(0.9) ? "paid" : "pending",
      });
    }
  }
  const charges = await chunkInsert("charges", chargeRows);
  if (charges.length !== chargeRows.length) {
    throw new Error(`charges: expected ${chargeRows.length}, inserted ${charges.length}`);
  }

  const chargeByLease = new Map();
  for (const charge of charges) {
    const list = chargeByLease.get(charge.lease_id) ?? [];
    list.push(charge);
    chargeByLease.set(charge.lease_id, list);
  }

  const leaseById = new Map(leases.map((l) => [l.id, l]));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  // Receipt numbers continue after anything already recorded for the organization.
  const { data: existingReceipts } = await db
    .from("payments")
    .select("receipt_year, receipt_no")
    .eq("org_id", ORG_ID)
    .not("receipt_no", "is", null);
  const receiptByYear = new Map();
  for (const row of existingReceipts ?? []) {
    receiptByYear.set(
      row.receipt_year,
      Math.max(receiptByYear.get(row.receipt_year) ?? 0, row.receipt_no ?? 0),
    );
  }
  let receiptNo = 1;
  const paymentRows = [];
  const allocationRows = [];
  for (const charge of charges) {
    if (charge.status !== "paid") continue;
    const lease = leaseById.get(charge.lease_id);
    const method = pick(METHODS);
    const receivedAt = addDays(new Date(charge.due_date), between(-3, 6));
    const year = receivedAt.getUTCFullYear();
    receiptNo = (receiptByYear.get(year) ?? 0) + 1;
    receiptByYear.set(year, receiptNo);
    paymentRows.push({
      org_id: ORG_ID,
      tenant_id: lease.tenant_id,
      lease_id: lease.id,
      receipt_no: receiptNo,
      receipt_year: year,
      amount_minor: charge.amount_minor,
      currency: CURRENCY,
      method,
      received_at: receivedAt.toISOString(),
      reference: `${method === "cash" ? "CASH" : "TRX"}-${between(10000, 99999)}`,
    });
  }
  const payments = await chunkInsert("payments", paymentRows);
  if (payments.length !== paymentRows.length) {
    throw new Error(`payments: expected ${paymentRows.length}, inserted ${payments.length}`);
  }

  payments.forEach((payment, index) => {
    const leaseCharges = chargeByLease.get(payment.lease_id) ?? [];
    const match = leaseCharges.find((c) => c.status === "paid");
    if (match) {
      allocationRows.push({
        payment_id: payment.id,
        charge_id: match.id,
        amount_minor: payment.amount_minor,
      });
    }
    void index;
  });
  await chunkInsert("payment_allocations", allocationRows);

  // Tenant proof waiting for confirmation.
  const proofTenant = tenants[3];
  const proofLease = leases.find((l) => l.tenant_id === proofTenant.id && l.status === "active");
  if (proofLease) {
    await db.from("payments").insert({
      org_id: ORG_ID,
      tenant_id: proofTenant.id,
      lease_id: proofLease.id,
      amount_minor: proofLease.rent_minor,
      currency: CURRENCY,
      method: "bank_transfer",
      received_at: addDays(TODAY, -2).toISOString(),
      reference: "TRX-778899",
      status: "pending_confirmation",
    });
  }
  console.log(`charges ${charges.length}, payments ${payments.length}`);

  // ── cheques ─────────────────────────────────────────────────────────────────
  const chequeRows = [];
  for (const [index, lease] of leases.filter((l) => l.status === "active").entries()) {
    if (!chance(0.22)) continue;
    const tenant = tenantById.get(lease.tenant_id);
    const status = pick(["received", "received", "deposited", "cleared", "cleared", "bounced"]);
    const due = addDays(TODAY, between(-40, 45));
    chequeRows.push({
      org_id: ORG_ID,
      lease_id: lease.id,
      tenant_id: tenant.id,
      cheque_no: `00${between(1000, 9999)}`,
      bank_name: pick(BANKS),
      amount_minor: lease.rent_minor,
      currency: CURRENCY,
      cheque_date: iso(due),
      status,
      deposited_at: status === "received" ? null : iso(addDays(due, 2)),
      cleared_at: status === "cleared" ? iso(addDays(due, 5)) : null,
      bounce_reason: status === "bounced" ? pick(["Insufficient funds", "Signature mismatch", "Account closed"]) : null,
    });
    void index;
  }
  await chunkInsert("cheques", chequeRows);

  // ── deposits ────────────────────────────────────────────────────────────────
  const depositRows = [];
  const depositTxnRows = [];
  for (const lease of leases.filter((l) => l.status === "active" && l.deposit_minor > 0)) {
    const held = lease.deposit_minor;
    const deducted = chance(0.18) ? Math.round(held * 0.2) : 0;
    const refunded = deducted > 0 && chance(0.4) ? Math.round(deducted * 0.5) : 0;
    depositRows.push({
      org_id: ORG_ID,
      lease_id: lease.id,
      tenant_id: lease.tenant_id,
      amount_minor: held,
      currency: CURRENCY,
      held_minor: held,
      deducted_minor: deducted,
      refunded_minor: refunded,
      received_at: lease.start_date,
    });
  }
  const { data: deposits } = await db.from("deposits").insert(depositRows).select();
  for (const deposit of deposits ?? []) {
    const lease = leaseById.get(deposit.lease_id);
    depositTxnRows.push({
      org_id: ORG_ID,
      deposit_id: deposit.id,
      kind: "receipt",
      amount_minor: deposit.amount_minor,
      reason: "Security deposit received",
      created_at: `${lease?.start_date ?? iso(TODAY)}T09:00:00.000Z`,
    });
    if (deposit.deducted_minor > 0) {
      depositTxnRows.push({
        org_id: ORG_ID,
        deposit_id: deposit.id,
        kind: "deduction",
        amount_minor: deposit.deducted_minor,
        reason: pick(["Wall painting", "Broken window", "Cleaning", "Key replacement"]),
        created_at: `${iso(addDays(TODAY, -between(5, 90)))}T10:00:00.000Z`,
      });
    }
    if (deposit.refunded_minor > 0) {
      depositTxnRows.push({
        org_id: ORG_ID,
        deposit_id: deposit.id,
        kind: "refund",
        amount_minor: deposit.refunded_minor,
        reason: "Partial refund on move-out",
        created_at: `${iso(addDays(TODAY, -between(1, 40)))}T11:00:00.000Z`,
        created_by: adminUserId,
      });
    }
  }
  await chunkInsert("deposit_transactions", depositTxnRows);

  // ── vendors and expenses ────────────────────────────────────────────────────
  const { data: vendors, error: vendorError } = await db
    .from("vendors")
    .insert(
      VENDORS.map((v) => ({
        org_id: ORG_ID,
        name: v.name,
        category: v.trade,
        contact: { trade: v.trade, rating: Number((3.5 + rnd() * 1.5).toFixed(2)) },
        phone: `+974 4${between(100, 999)} ${between(1000, 9999)}`,
        email: `accounts@${v.name.toLowerCase().replace(/[^a-z]+/g, "")}.example.com`,
      })),
    )
    .select();
  if (vendorError) throw new Error(`vendors: ${vendorError.message}`);

  const { data: bankAccounts, error: bankError } = await db
    .from("bank_accounts")
    .insert([
      { org_id: ORG_ID, name: "Operating Account", account_no: "QNB-0012345678", bank_name: BANKS[0], currency: CURRENCY, is_default: true },
      { org_id: ORG_ID, name: "Tenant Collection Account", account_no: "MASHREQ-0098765432", bank_name: BANKS[1], currency: CURRENCY, is_default: false },
    ])
    .select();
  if (bankError) throw new Error(`bank_accounts: ${bankError.message}`);
  const bank = (bankAccounts ?? [])[0];

  const buildingByCode = new Map(buildings.map((b, i) => [PROPERTIES[i].code, b]));
  const expenseRows = [];
  for (const [index, property] of PROPERTIES.entries()) {
    const building = buildingByCode.get(property.code);
    for (let n = 0; n < between(4, 7); n += 1) {
      const [description, category] = pick(EXPENSE_TITLES);
      const vendor = pick(vendors ?? []);
      const expenseDate = addDays(TODAY, -between(1, 300));
      const paid = chance(0.75);
      expenseRows.push({
        org_id: ORG_ID,
        vendor_id: vendor?.id ?? null,
        building_id: building.id,
        category,
        description,
        amount_minor: between(35_000, 480_000),
        currency: CURRENCY,
        status: paid ? "paid" : chance(0.5) ? "approved" : "draft",
        expense_date: iso(expenseDate),
        paid_at: paid ? iso(addDays(expenseDate, between(0, 20))) : null,
        bank_account_id: paid ? (bank?.id ?? null) : null,
        submitted_by: adminUserId,
        approved_by: paid ? adminUserId : null,
      });
    }
  }
  const { data: expenses } = await db.from("expenses").insert(expenseRows).select();

  // One expense waiting for owner approval, above the owner's threshold.
  const approvalBuilding = buildings[0];
  const { data: pendingExpense } = await db
    .from("expenses")
    .insert({
      org_id: ORG_ID,
      vendor_id: vendors?.[0]?.id ?? null,
      building_id: approvalBuilding.id,
      category: "Maintenance and Repairs",
      description: "Full lift replacement — Capital works",
      amount_minor: 8_500_00,
      currency: CURRENCY,
      status: "pending_owner_approval",
      expense_date: iso(addDays(TODAY, -6)),
      submitted_by: adminUserId,
    })
    .select();
  if (pendingExpense?.[0]) {
    await db.from("owner_expense_approvals").insert({
      org_id: ORG_ID,
      expense_id: pendingExpense[0].id,
      owner_id: manar.id,
      status: "pending",
      requested_at: addDays(TODAY, -6).toISOString(),
    });
  }
  console.log(`expenses ${expenses?.length ?? 0}, vendors ${vendors?.length ?? 0}`);

  // ── maintenance and inspections ─────────────────────────────────────────────
  const requestRows = [];
  for (const [index, property] of PROPERTIES.entries()) {
    const building = buildingByCode.get(property.code);
    const buildingUnits = units.filter((u) => u.building_id === building.id);
    for (let n = 0; n < between(3, 6); n += 1) {
      const [title, category, priority] = pick(MAINTENANCE_TITLES);
      const unit = pick(buildingUnits);
      const tenant = tenants[(index * 7 + n) % tenants.length];
      const status = pick(["open", "open", "assigned", "in_progress", "resolved", "closed"]);
      requestRows.push({
        org_id: ORG_ID,
        building_id: building.id,
        unit_id: unit.id,
        tenant_id: tenant.id,
        category,
        priority,
        status,
        title,
        description: "Reported through the tenant portal.",
        assigned_vendor_id: status === "open" ? null : pick(vendors ?? []).id ?? null,
        cost_minor: status === "resolved" || status === "closed" ? between(15_000, 260_000) : null,
        currency: CURRENCY,
        charge_to: chance(0.6) ? "owner" : "company",
        opened_at: addDays(TODAY, -between(1, 120)).toISOString(),
        resolved_at: status === "resolved" || status === "closed" ? addDays(TODAY, -between(0, 20)).toISOString() : null,
      });
    }
  }
  const { data: requests } = await db.from("maintenance_requests").insert(requestRows).select();
  const eventRows = (requests ?? []).map((r) => ({
    org_id: ORG_ID,
    request_id: r.id,
    kind: "status_change",
    body: `Request created — status ${r.status.replace("_", " ")}`,
    author_id: adminUserId,
  }));
  await chunkInsert("maintenance_events", eventRows);

  const inspectionRows = [];
  for (const lease of leases.filter((l) => l.status === "active").slice(0, 40)) {
    inspectionRows.push({
      org_id: ORG_ID,
      lease_id: lease.id,
      kind: "move_in",
      data: {
        condition: pick(["good", "good", "fair", "needs_repair"]),
        meter_readings: { electricity: between(100, 900), water: between(10, 90) },
        keys_handed: between(1, 2),
        notes: "Move-in inspection completed.",
      },
      completed_at: addDays(new Date(lease.start_date), between(0, 2)).toISOString(),
      tenant_signed: chance(0.7),
    });
  }
  await chunkInsert("inspections", inspectionRows);

  // ── meters ──────────────────────────────────────────────────────────────────
  const meterRows = [];
  for (const [index, property] of PROPERTIES.entries()) {
    const building = buildingByCode.get(property.code);
    for (const kind of ["electricity", "water"]) {
      meterRows.push({
        org_id: ORG_ID,
        building_id: building.id,
        kind,
        meter_no: `${property.code}-${kind.toUpperCase().slice(0, 3)}-01`,
      });
    }
    void index;
  }
  const { data: meters } = await db.from("meters").insert(meterRows).select();
  const readingRows = [];
  for (const meter of meters ?? []) {
    let value = between(500, 4000);
    for (let month = 6; month >= 0; month -= 1) {
      const used = between(120, 900);
      readingRows.push({
        org_id: ORG_ID,
        meter_id: meter.id,
        read_on: iso(monthStart(addMonthsSafe(TODAY, -month))),
        value: value + used,
        read_by: adminUserId,
      });
      value += used;
    }
  }
  await chunkInsert("meter_readings", readingRows);

  // ── ledger: journals for the money movements ────────────────────────────────
  const { data: accounts } = await db.from("accounts").select("id, code").eq("org_id", ORG_ID);
  const accountByCode = new Map((accounts ?? []).map((a) => [a.code, a.id]));
  const A = {
    cash: accountByCode.get("1010"),
    bank: accountByCode.get("1020"),
    receivable: accountByCode.get("1100"),
    tenantReceivable: accountByCode.get("1110"),
    deposits: accountByCode.get("1120"),
    advance: accountByCode.get("2010"),
    rentRevenue: accountByCode.get("4010"),
    commercialRevenue: accountByCode.get("4020"),
    feeIncome: accountByCode.get("4120"),
    expenses: accountByCode.get("5000"),
    maintenance: accountByCode.get("5010"),
    utilities: accountByCode.get("5020"),
    insurance: accountByCode.get("5030"),
    admin: accountByCode.get("5050"),
  };
  const buildingByUnit = new Map(units.map((u) => [u.id, u.building_id]));

  const journalRows = [];
  const lineRows = [];
  const addJournal = (sourceType, sourceId, postedOn, lines, memo) => {
    const journalId = crypto.randomUUID();
    journalRows.push({
      id: journalId,
      org_id: ORG_ID,
      posted_at: iso(postedOn),
      source_type: sourceType,
      source_id: sourceId,
      currency: CURRENCY,
      memo,
      posted_by: adminUserId,
    });
    for (const line of lines) {
      lineRows.push({
        org_id: ORG_ID,
        journal_id: journalId,
        account_id: line.account,
        debit_minor: line.debit ?? 0,
        credit_minor: line.credit ?? 0,
        tenant_id: line.tenantId ?? null,
        lease_id: line.leaseId ?? null,
        building_id: line.buildingId ?? null,
        unit_id: line.unitId ?? null,
        description: line.description ?? memo,
      });
    }
  };

  for (const charge of charges) {
    if (charge.type !== "rent" || charge.status === "void") continue;
    const lease = leaseById.get(charge.lease_id);
    const unit = units.find((u) => u.id === lease.unit_id);
    addJournal(
      "charge",
      charge.id,
      new Date(charge.due_date),
      [
        {
          account: A.tenantReceivable,
          debit: charge.amount_minor,
          leaseId: lease.id,
          buildingId: unit?.building_id,
          unitId: lease.unit_id,
          tenantId: lease.tenant_id,
          description: "Rent receivable",
        },
        {
          account: unit?.unit_type === "office" ? A.commercialRevenue : A.rentRevenue,
          credit: charge.amount_minor,
          leaseId: lease.id,
          buildingId: unit?.building_id,
          unitId: lease.unit_id,
          tenantId: lease.tenant_id,
          description: "Rental income",
        },
      ],
      "Rent charge",
    );
  }

  for (const payment of payments) {
    const lease = leaseById.get(payment.lease_id);
    const unit = units.find((u) => u.id === lease?.unit_id);
    const isCash = payment.method === "cash";
    addJournal(
      "payment",
      payment.id,
      new Date(payment.received_at),
      [
        {
          account: isCash ? A.cash : A.bank,
          debit: payment.amount_minor,
          leaseId: lease?.id,
          buildingId: unit?.building_id,
          unitId: lease?.unit_id,
          tenantId: lease?.tenant_id,
          description: "Payment received",
        },
        {
          account: A.tenantReceivable,
          credit: payment.amount_minor,
          leaseId: lease?.id,
          buildingId: unit?.building_id,
          unitId: lease?.unit_id,
          description: "Payment received",
        },
      ],
      "Payment received",
    );
  }

  for (const deposit of deposits ?? []) {
    const lease = leaseById.get(deposit.lease_id);
    const unit = units.find((u) => u.id === lease?.unit_id);
    addJournal(
      "deposit_txn",
      deposit.id,
      new Date(deposit.received_at),
      [
        {
          account: A.bank,
          debit: deposit.amount_minor,
          leaseId: lease?.id,
          buildingId: unit?.building_id,
          tenantId: lease?.tenant_id,
          description: "Security deposit received",
        },
        {
          account: A.deposits,
          credit: deposit.amount_minor,
          leaseId: lease?.id,
          buildingId: unit?.building_id,
          tenantId: lease?.tenant_id,
          description: "Security deposits held",
        },
      ],
      "Security deposit received",
    );
  }

  const expenseAccountFor = (category) => {
    if (category.includes("Maintenance")) return A.maintenance;
    if (category.includes("Utilities")) return A.utilities;
    if (category.includes("Insurance")) return A.insurance;
    return A.admin;
  };
  for (const expense of expenses ?? []) {
    if (expense.status !== "paid") continue;
    addJournal(
      "expense",
      expense.id,
      new Date(expense.paid_at ?? expense.expense_date),
      [
        {
          account: expenseAccountFor(expense.category),
          debit: expense.amount_minor,
          buildingId: expense.building_id,
          description: expense.description,
        },
        {
          account: A.bank,
          credit: expense.amount_minor,
          buildingId: expense.building_id,
          description: expense.description,
        },
      ],
      expense.description,
    );
  }

  await chunkInsert("journals", journalRows);
  await chunkInsert("journal_lines", lineRows);
  console.log(`journals ${journalRows.length}, lines ${lineRows.length}`);

  // ── owner ledger and statements ─────────────────────────────────────────────
  // The table keys the owner through the building, so the script keeps its own
  // ownerId on the row for bookkeeping and drops it before the insert.
  const ownerLedgerRows = [];
  for (const payment of payments) {
    const lease = leaseById.get(payment.lease_id);
    const unit = units.find((u) => u.id === lease?.unit_id);
    const building = buildings.find((b) => b.id === unit?.building_id);
    if (!building || (building.owner_id !== manar.id && building.owner_id !== horizon.id)) continue;
    ownerLedgerRows.push({
      ownerId: building.owner_id,
      row: {
        org_id: ORG_ID,
        building_id: building.id,
        kind: "collection",
        amount_minor: payment.amount_minor,
        currency: CURRENCY,
        entry_date: iso(new Date(payment.received_at)),
        description: `Rent collected — ${building.code}`,
      },
    });
  }
  for (const expense of expenses ?? []) {
    const building = buildings.find((b) => b.id === expense.building_id);
    if (!building || (building.owner_id !== manar.id && building.owner_id !== horizon.id)) continue;
    if (expense.status !== "paid") continue;
    ownerLedgerRows.push({
      ownerId: building.owner_id,
      row: {
        org_id: ORG_ID,
        building_id: building.id,
        kind: "expense",
        amount_minor: -expense.amount_minor,
        currency: CURRENCY,
        entry_date: expense.expense_date,
        description: expense.description,
      },
    });
  }

  const statementRows = [];
  const payoutRows = [];
  for (const owner of [manar, horizon]) {
    const ownerBuildings = buildings.filter((b) => b.owner_id === owner.id);
    const entries = ownerLedgerRows.filter((e) => e.ownerId === owner.id);
    const collections = entries
      .filter((e) => e.row.kind === "collection")
      .reduce((acc, e) => acc + e.row.amount_minor, 0);
    const expenseTotal = entries
      .filter((e) => e.row.kind === "expense")
      .reduce((acc, e) => acc + e.row.amount_minor, 0);
    const fee =
      owner.fee_type === "percent_of_collections"
        ? Math.round((collections * owner.fee_value) / 100)
        : owner.fee_value * ownerBuildings.length * 8;

    for (let month = 2; month >= 0; month -= 1) {
      const start = monthStart(addMonthsSafe(TODAY, -month));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
      const share = month === 0 ? 0.4 : 0.33;
      const periodCollections = Math.round(collections * share);
      const periodExpenses = Math.round(expenseTotal * share);
      const periodFee = Math.round(fee * share);
      const net = periodCollections + periodExpenses - periodFee;
      const status = month === 0 ? "draft" : month === 1 ? "review" : "issued";
      const { data: statement } = await db
        .from("owner_statements")
        .insert({
          org_id: ORG_ID,
          period_start: iso(start),
          period_end: iso(end),
          currency: CURRENCY,
          status,
          opening_minor: month === 2 ? 0 : Math.round(collections * 0.2 * (2 - month)),
          closing_minor: net,
          totals: {
            collections: periodCollections,
            expenses: Math.abs(periodExpenses),
            management_fee: periodFee,
            net_payable: net,
          },
          lines: [
            { kind: "collection", description: "Rent collected", amount_minor: periodCollections },
            { kind: "expense", description: "Operating expenses", amount_minor: periodExpenses },
            { kind: "management_fee", description: "Management fee", amount_minor: periodFee },
          ],
          issued_at: status === "issued" ? addDays(end, 3).toISOString() : null,
          issued_by: status === "issued" ? adminUserId : null,
        })
        .select();
      const statementId = statement?.[0]?.id;
      if (statementId) statementRows.push(statementId);
      if (statementId && status === "issued" && net > 0) {
        payoutRows.push({
          org_id: ORG_ID,
          owner_id: owner.id,
          statement_id: statementId,
          amount_minor: net,
          currency: CURRENCY,
          paid_on: iso(addDays(end, 5)),
          method: "bank_transfer",
          reference: `PAY-${owner.id.slice(0, 4)}-${month}`,
          bank_account_id: bankAccounts?.[0]?.id ?? null,
        });
        ownerLedgerRows.push({
          ownerId: owner.id,
          row: {
            org_id: ORG_ID,
            building_id: ownerBuildings[0].id,
            kind: "payout",
            amount_minor: -net,
            currency: CURRENCY,
            entry_date: iso(addDays(end, 5)),
            description: "Owner payout",
          },
        });
        ownerLedgerRows.push({
          ownerId: owner.id,
          row: {
            org_id: ORG_ID,
            building_id: ownerBuildings[0].id,
            kind: "management_fee",
            amount_minor: -periodFee,
            currency: CURRENCY,
            entry_date: iso(end),
            description: "Management fee",
          },
        });
      }
    }
  }
  await chunkInsert("owner_ledger_entries", ownerLedgerRows.map((e) => e.row));
  await chunkInsert("owner_payouts", payoutRows);

  // ── accounting periods, documents, notifications, usage ─────────────────────
  await db.from("accounting_periods").insert(
    [-2, -1].map((months) => ({
      org_id: ORG_ID,
      month: iso(monthStart(addMonthsSafe(TODAY, months))),
      status: "closed",
      closed_by: adminUserId,
      closed_at: addDays(monthStart(addMonthsSafe(TODAY, months + 1)), 1).toISOString(),
    })),
  );

  const documentRows = leases.slice(0, 60).map((lease) => ({
    org_id: ORG_ID,
    entity_type: "lease",
    entity_id: lease.id,
    kind: "contract",
    path: `${ORG_ID}/lease/${lease.id}/contract.pdf`,
    expires_on: iso(addDays(new Date(lease.end_date), 30)),
    uploaded_by: adminUserId,
  }));
  await chunkInsert("documents", documentRows);

  await db.from("notification_templates").upsert(
    [
      { event: "rent_due", channel: "email", locale: "en", subject: "Rent due", body: "Dear tenant, rent of {{amount}} is due on {{date}}." },
      { event: "rent_due", channel: "email", locale: "ar", subject: "الإيجار مستحق", body: "عزيزي المستأجر، مبلغ الإيجار {{amount}} مستحق في {{date}}." },
      { event: "cheque_bounced", channel: "email", locale: "en", subject: "Cheque bounced", body: "The cheque {{reference}} bounced: {{reason}}." },
      { event: "lease_expiring", channel: "email", locale: "en", subject: "Lease expiring", body: "Your lease {{lease_no}} expires on {{date}}." },
    ],
    { onConflict: "org_id,event,channel,locale" },
  );

  await db.from("notification_outbox").insert(
    ["rent_due", "rent_due", "cheque_bounced", "lease_expiring", "rent_due"].map((event, index) => ({
      org_id: ORG_ID,
      event,
      channel: "email",
      recipient: tenants[index % tenants.length].email ?? "tenant@example.com",
      locale: index % 2 === 0 ? "en" : "ar",
      payload: { amount: between(2_000, 15_000), date: iso(addDays(TODAY, between(1, 10))) },
      status: index === 3 ? "sent" : "queued",
      sent_at: index === 3 ? addDays(TODAY, -1).toISOString() : null,
    })),
  );

  // Keep the gapless receipt sequence in step with what was written.
  await db.from("receipt_sequences").upsert(
    [...receiptByYear.entries()]
      .filter(([, last]) => last > 0)
      .map(([year, last]) => ({ org_id: ORG_ID, year, last_no: last })),
  );

  await db.from("subscriptions").upsert({ org_id: ORG_ID, plan_code: "standard", status: "active" });  await db.from("usage_snapshots").insert(
    [-30, -15, -1].map((days) => ({
      org_id: ORG_ID,
      taken_on: iso(addDays(TODAY, days)),
      units: units.length,
      users: tenants.length + 20,
      storage_mb: between(400, 2400),
    })),
  );

  await db.from("market_packs").upsert(
    {
      country_code: "QA",
      version: 1,
      effective_from: iso(addDays(TODAY, -365)),
      rules: {
        id_types: ["QID", "Passport", "GCC ID"],
        weekend: ["Friday", "Saturday"],
        currency: "QAR",
        tax_rate: 0,
        notice_period_days: 60,
        holidays: [],
        templates: { lease: "en", receipt: "en" },
      },
    },
    { onConflict: "country_code,version" },
  );

  console.log(
    [
      `owners ${owners.length}`,
      `leases ${leases.length}`,
      `charges ${charges.length}`,
      `payments ${payments.length}`,
      `cheques ${chequeRows.length}`,
      `deposits ${deposits?.length ?? 0}`,
      `expenses ${expenses?.length ?? 0}`,
      `requests ${requests?.length ?? 0}`,
      `meters ${meters?.length ?? 0}`,
      `owner ledger ${ownerLedgerRows.length}`,
      `statements ${statementRows.length}`,
      `payouts ${payoutRows.length}`,
    ].join(", "),
  );
  console.log("logins: tenant@example.com / Tenant1234!, owner@example.com / Owner1234!, admin@example.com / Admin1234!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

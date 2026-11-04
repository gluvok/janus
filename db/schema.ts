import { defineRelations } from "drizzle-orm";
import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const USER_ROLES = ["admin", "manager", "operator", "base"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const WEIGHMENT_TYPES = ["in", "out"] as const;
export type WeighmentType = (typeof WEIGHMENT_TYPES)[number];

export const TICKET_STATUSES = ["pending", "resolved", "rejected"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

// -----------------------------------------------------------------------------
// 1. FACTORIES
// -----------------------------------------------------------------------------
export const factories = sqliteTable("factories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  receipt_images_per_row: integer("receipt_images_per_row").notNull().default(3),
  created_at: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updated_at: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// -----------------------------------------------------------------------------
// 2. CENTERS
// -----------------------------------------------------------------------------
export const centers = sqliteTable(
  "centers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    factory_id: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    created_at: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updated_at: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("idx_centers_factory_name").on(table.factory_id, table.name),
    index("idx_centers_factory").on(table.factory_id),
  ],
);

// -----------------------------------------------------------------------------
// 3. CUSTOMERS
// -----------------------------------------------------------------------------
export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    factory_id: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    created_at: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updated_at: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("idx_customers_factory_name").on(table.factory_id, table.name),
    index("idx_customers_factory").on(table.factory_id),
  ],
);

// -----------------------------------------------------------------------------
// 4. USERS
// -----------------------------------------------------------------------------
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    password_hash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: USER_ROLES }).notNull().default("base"),
    factory_id: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    created_at: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updated_at: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("idx_users_username").on(table.username),
    index("idx_users_factory").on(table.factory_id),
    index("idx_users_role").on(table.role),
  ],
);

// -----------------------------------------------------------------------------
// 5. DEVICES
// -----------------------------------------------------------------------------
export const devices = sqliteTable(
  "devices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    center_id: integer("center_id")
      .notNull()
      .references(() => centers.id, { onDelete: "restrict" }),
    api_key_hash: text("api_key_hash").notNull(),
    created_at: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updated_at: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex("idx_devices_center").on(table.center_id)],
);

// -----------------------------------------------------------------------------
// 6. SESSIONS
// -----------------------------------------------------------------------------
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    expires_at: text("expires_at").notNull(),
    created_at: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [index("idx_sessions_user").on(table.user_id)],
);

// -----------------------------------------------------------------------------
// 7. MANUAL ENTRIES
// -----------------------------------------------------------------------------
export const manual_entries = sqliteTable(
  "manual_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    vehicle_number: text("vehicle_number").notNull(),
    weight: real("weight").notNull(),
    center_id: integer("center_id")
      .notNull()
      .references(() => centers.id, { onDelete: "restrict" }),
    customer_id: integer("customer_id").references(() => customers.id, {
      onDelete: "restrict",
    }),
    creator_id: integer("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    images: text("images", { mode: "json" }).$type<string[]>().notNull().default([]),
    created_at: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updated_at: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("idx_manual_entries_center_vehicle").on(
      table.center_id,
      table.vehicle_number,
      table.created_at,
    ),
    index("idx_manual_entries_created_at").on(table.created_at),
    index("idx_manual_entries_creator_id").on(table.creator_id),
    index("idx_manual_entries_center").on(table.center_id),
    index("idx_manual_entries_customer").on(table.customer_id),
    index("idx_manual_entries_vehicle").on(table.vehicle_number),
  ],
);

// -----------------------------------------------------------------------------
// 8. AUTOMATIC ENTRIES
// -----------------------------------------------------------------------------
export const automatic_entries = sqliteTable(
  "automatic_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    device_id: integer("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    center_id: integer("center_id")
      .notNull()
      .references(() => centers.id, { onDelete: "restrict" }),
    customer_id: integer("customer_id").references(() => customers.id, {
      onDelete: "restrict",
    }),
    detected_vehicle_number: text("detected_vehicle_number").notNull().default("NO_PLATE_DETECTED"),
    vehicle_number: text("vehicle_number").notNull().default("NO_PLATE_DETECTED"),
    weight: real("weight").notNull(),
    images: text("images", { mode: "json" }).$type<string[]>().notNull().default([]),
    created_at: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updated_at: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("idx_automatic_entries_device").on(table.device_id, table.created_at),
    index("idx_automatic_entries_center_created").on(table.center_id, table.created_at),
    index("idx_automatic_entries_vehicle").on(table.vehicle_number, table.created_at),
    index("idx_automatic_entries_customer").on(table.customer_id),
  ],
);

// -----------------------------------------------------------------------------
// 9. MANUAL WEIGHMENTS
// -----------------------------------------------------------------------------
export const manual_weighments = sqliteTable(
  "manual_weighments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    in_entry_id: integer("in_entry_id")
      .notNull()
      .references(() => manual_entries.id, { onDelete: "restrict" }),
    out_entry_id: integer("out_entry_id")
      .notNull()
      .references(() => manual_entries.id, { onDelete: "restrict" }),
    type: text("type", { enum: WEIGHMENT_TYPES }).notNull().default("in"),
    created_at: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updated_at: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("idx_manual_weighments_in_entry").on(table.in_entry_id),
    uniqueIndex("idx_manual_weighments_out_entry").on(table.out_entry_id),
    index("idx_manual_weighments_created").on(table.created_at),
  ],
);

// -----------------------------------------------------------------------------
// 10. AUTOMATIC WEIGHMENTS
// -----------------------------------------------------------------------------
export const automatic_weighments = sqliteTable(
  "automatic_weighments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    in_entry_id: integer("in_entry_id")
      .notNull()
      .references(() => automatic_entries.id, { onDelete: "restrict" }),
    out_entry_id: integer("out_entry_id")
      .notNull()
      .references(() => automatic_entries.id, { onDelete: "restrict" }),
    type: text("type", { enum: WEIGHMENT_TYPES }).notNull().default("in"),
    created_at: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updated_at: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("idx_automatic_weighments_in_entry").on(table.in_entry_id),
    uniqueIndex("idx_automatic_weighments_out_entry").on(table.out_entry_id),
    index("idx_automatic_weighments_created").on(table.created_at),
  ],
);

// -----------------------------------------------------------------------------
// 11. TICKETS
// -----------------------------------------------------------------------------
export const tickets = sqliteTable(
  "tickets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    concern: text("concern").notNull(),
    reply: text("reply"),
    status: text("status", { enum: TICKET_STATUSES }).notNull().default("pending"),
    entry_id: integer("entry_id")
      .notNull()
      .references(() => automatic_entries.id, { onDelete: "restrict" }),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    created_at: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updated_at: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("idx_tickets_user_status").on(table.user_id, table.status, table.created_at),
    index("idx_tickets_entry").on(table.entry_id),
    index("idx_tickets_created_desc").on(table.created_at),
  ],
);

// -----------------------------------------------------------------------------
// RELATIONS
// -----------------------------------------------------------------------------
export const tables = {
  factories,
  centers,
  customers,
  users,
  devices,
  sessions,
  manual_entries,
  automatic_entries,
  manual_weighments,
  automatic_weighments,
  tickets,
};

export const relations = defineRelations(tables, (r) => ({
  factories: {
    centers: r.many.centers(),
    customers: r.many.customers(),
    users: r.many.users(),
  },
  centers: {
    factory: r.one.factories({ from: r.centers.factory_id, to: r.factories.id }),
    devices: r.many.devices(),
    manual_entries: r.many.manual_entries(),
    automatic_entries: r.many.automatic_entries(),
  },
  customers: {
    factory: r.one.factories({ from: r.customers.factory_id, to: r.factories.id }),
    manual_entries: r.many.manual_entries(),
    automatic_entries: r.many.automatic_entries(),
  },
  users: {
    factory: r.one.factories({ from: r.users.factory_id, to: r.factories.id }),
    sessions: r.many.sessions(),
    tickets: r.many.tickets(),
    manual_entries: r.many.manual_entries(),
  },
  devices: {
    center: r.one.centers({ from: r.devices.center_id, to: r.centers.id }),
    automatic_entries: r.many.automatic_entries(),
  },
  sessions: {
    user: r.one.users({ from: r.sessions.user_id, to: r.users.id }),
  },
  manual_entries: {
    center: r.one.centers({ from: r.manual_entries.center_id, to: r.centers.id }),
    customer: r.one.customers({ from: r.manual_entries.customer_id, to: r.customers.id }),
    creator: r.one.users({ from: r.manual_entries.creator_id, to: r.users.id }),
  },
  automatic_entries: {
    device: r.one.devices({ from: r.automatic_entries.device_id, to: r.devices.id }),
    center: r.one.centers({ from: r.automatic_entries.center_id, to: r.centers.id }),
    customer: r.one.customers({ from: r.automatic_entries.customer_id, to: r.customers.id }),
    tickets: r.many.tickets(),
  },
  manual_weighments: {
    in_entry: r.one.manual_entries({
      from: r.manual_weighments.in_entry_id,
      to: r.manual_entries.id,
    }),
    out_entry: r.one.manual_entries({
      from: r.manual_weighments.out_entry_id,
      to: r.manual_entries.id,
    }),
  },
  automatic_weighments: {
    in_entry: r.one.automatic_entries({
      from: r.automatic_weighments.in_entry_id,
      to: r.automatic_entries.id,
    }),
    out_entry: r.one.automatic_entries({
      from: r.automatic_weighments.out_entry_id,
      to: r.automatic_entries.id,
    }),
  },
  tickets: {
    entry: r.one.automatic_entries({ from: r.tickets.entry_id, to: r.automatic_entries.id }),
    user: r.one.users({ from: r.tickets.user_id, to: r.users.id }),
  },
}));

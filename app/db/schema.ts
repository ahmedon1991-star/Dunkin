import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  timestamp,
  text,
} from "drizzle-orm/pg-core";

export const modeEnum = pgEnum("mode", ["simple", "detailed"]);
export const unitCodeEnum = pgEnum("unit_code", ["CTN", "PKT", "PCS"]);
export const snapshotPeriodEnum = pgEnum("period", ["weekly", "monthly"]);

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  nameAr: varchar("name_ar", { length: 512 }).notNull(),
  nameEn: varchar("name_en", { length: 512 }).notNull(),
  category: varchar("category", { length: 255 }).notNull(),
  mode: modeEnum("mode").notNull().default("simple"),
  qty: integer("qty"),
  packs: integer("packs"),
  packSize: integer("pack_size"),
  loose: integer("loose"),
  orderQty: integer("order_qty"),
  unitCode: unitCodeEnum("unit_code").notNull(),
  unitLabel: varchar("unit_label", { length: 64 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const inventorySnapshots = pgTable("inventory_snapshots", {
  id: serial("id").primaryKey(),
  period: snapshotPeriodEnum("period").notNull(),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
  data: text("data").notNull(),
});

export type Product = typeof products.$inferSelect;
export type InventorySnapshot = typeof inventorySnapshots.$inferSelect;

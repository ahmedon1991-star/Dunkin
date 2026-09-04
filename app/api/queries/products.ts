import { asc, eq, sql } from "drizzle-orm";
import { inventorySnapshots, products } from "@db/schema";
import { getDb } from "./connection";

export function normalizeOptionalImageUrl(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

export function listProducts() {
  return getDb().select().from(products).orderBy(asc(products.sortOrder), asc(products.id));
}

export async function updateProduct(
  id: number,
  fields: Partial<{
    mode: "simple" | "detailed";
    qty: number | null;
    packs: number | null;
    packSize: number | null;
    loose: number | null;
    orderQty: number | null;
    imageUrl: string | null;
  }>,
) {
  await getDb().update(products).set(fields).where(eq(products.id, id));
}

export async function addProduct(input: {
  code: string;
  nameAr: string;
  nameEn: string;
  category: string;
  mode: "simple" | "detailed";
  unitCode: "CTN" | "PKT" | "PCS";
  unitLabel: string;
  imageUrl?: string | null;
}) {
  const db = getDb();
  const rows = await db
    .select({ maxSort: sql<number>`COALESCE(MAX(${products.sortOrder}), 0)` })
    .from(products);
  const next = (rows[0]?.maxSort ?? 0) + 1;
  const normalizedImageUrl = normalizeOptionalImageUrl(input.imageUrl);
  await db.insert(products).values({ ...input, imageUrl: normalizedImageUrl, sortOrder: next });
}

export async function editProduct(
  id: number,
  fields: Partial<Pick<typeof products.$inferInsert, "code" | "nameAr" | "nameEn" | "category" | "mode" | "unitCode" | "unitLabel" | "imageUrl">>,
) {
  const normalizedFields = {
    ...fields,
    imageUrl: fields.imageUrl === undefined ? undefined : normalizeOptionalImageUrl(fields.imageUrl),
  };
  await getDb().update(products).set(normalizedFields).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  await getDb().delete(products).where(eq(products.id, id));
}

export async function saveInventorySnapshot(period: "weekly" | "monthly", data: string) {
  await getDb().insert(inventorySnapshots).values({ period, data });
}

export function listInventorySnapshots() {
  return getDb().select().from(inventorySnapshots).orderBy(sql`${inventorySnapshots.capturedAt} DESC`);
}

export async function resetAllStock() {
  await getDb()
    .update(products)
    .set({ qty: null, packs: null, packSize: null, loose: null, orderQty: null });
}

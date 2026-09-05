import { asc, eq, sql } from "drizzle-orm";
import { inventorySnapshots, products, type Product } from "@db/schema";
import { getDb } from "./connection";
import { seedProducts } from "../../db/seedData";

function toNullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

let memoryProducts: Product[] = seedProducts.map((p, index) => ({
  id: index + 1,
  code: p.code,
  nameAr: p.name_ar,
  nameEn: p.name_en,
  category: p.category,
  mode: p.mode === "detailed" ? "detailed" : "simple",
  qty: toNullableNumber(p.qty),
  packs: toNullableNumber(p.packs),
  packSize: toNullableNumber(p.pack_size),
  loose: toNullableNumber(p.loose),
  orderQty: null,
  unitCode: (p.unit_code === "CTN" || p.unit_code === "PKT" || p.unit_code === "PCS" ? p.unit_code : "PCS") as "CTN" | "PKT" | "PCS",
  unitLabel: p.unit_label,
  imageUrl: null,
  sortOrder: index + 1,
  createdAt: new Date(),
  updatedAt: new Date(),
}));

let memorySnapshots: Array<{ id: number; period: "weekly" | "monthly"; capturedAt: Date; data: string }> = [];

export function normalizeOptionalImageUrl(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

export async function listProducts(): Promise<Product[]> {
  try {
    const res = await Promise.race([
      getDb().select().from(products).orderBy(asc(products.sortOrder), asc(products.id)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB Timeout")), 2500))
    ]);
    if (res && res.length > 0) {
      memoryProducts = res;
      return res;
    }
    return memoryProducts;
  } catch (err) {
    console.warn("DB connection timeout/error, serving fallback 256 products catalog:", err);
    return memoryProducts;
  }
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
  memoryProducts = memoryProducts.map((p) => (p.id === id ? { ...p, ...fields, updatedAt: new Date() } : p));
  try {
    await getDb().update(products).set(fields).where(eq(products.id, id));
  } catch (err) {
    console.warn("DB update fallback to memory:", err);
  }
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
  const normalizedImageUrl = normalizeOptionalImageUrl(input.imageUrl);
  const newId = memoryProducts.length > 0 ? Math.max(...memoryProducts.map((p) => p.id)) + 1 : 1;
  const nextSort = memoryProducts.length > 0 ? Math.max(...memoryProducts.map((p) => p.sortOrder)) + 1 : 1;

  const newProd: Product = {
    id: newId,
    code: input.code,
    nameAr: input.nameAr,
    nameEn: input.nameEn,
    category: input.category,
    mode: input.mode,
    qty: null,
    packs: null,
    packSize: null,
    loose: null,
    orderQty: null,
    unitCode: input.unitCode,
    unitLabel: input.unitLabel,
    imageUrl: normalizedImageUrl,
    sortOrder: nextSort,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  memoryProducts.push(newProd);

  try {
    const db = getDb();
    await db.insert(products).values({ ...input, imageUrl: normalizedImageUrl, sortOrder: nextSort });
  } catch (err) {
    console.warn("DB insert fallback to memory:", err);
  }
}

export async function editProduct(
  id: number,
  fields: Partial<Pick<typeof products.$inferInsert, "code" | "nameAr" | "nameEn" | "category" | "mode" | "unitCode" | "unitLabel" | "imageUrl">>,
) {
  const normalizedImageUrl = fields.imageUrl === undefined ? undefined : normalizeOptionalImageUrl(fields.imageUrl);
  const normalizedFields = {
    ...fields,
    ...(normalizedImageUrl !== undefined ? { imageUrl: normalizedImageUrl } : {}),
  };

  memoryProducts = memoryProducts.map((p) => {
    if (p.id === id) {
      return {
        ...p,
        ...fields,
        imageUrl: normalizedImageUrl !== undefined ? normalizedImageUrl : p.imageUrl,
        updatedAt: new Date(),
      };
    }
    return p;
  });

  try {
    await getDb().update(products).set(normalizedFields).where(eq(products.id, id));
  } catch (err) {
    console.warn("DB edit fallback to memory:", err);
  }
}

export async function deleteProduct(id: number) {
  memoryProducts = memoryProducts.filter((p) => p.id !== id);
  try {
    await getDb().delete(products).where(eq(products.id, id));
  } catch (err) {
    console.warn("DB delete fallback to memory:", err);
  }
}

export async function saveInventorySnapshot(period: "weekly" | "monthly", data: string) {
  memorySnapshots.unshift({ id: Date.now(), period, capturedAt: new Date(), data });
  try {
    await getDb().insert(inventorySnapshots).values({ period, data });
  } catch (err) {
    console.warn("DB snapshot fallback to memory:", err);
  }
}

export async function listInventorySnapshots() {
  try {
    const res = await Promise.race([
      getDb().select().from(inventorySnapshots).orderBy(sql`${inventorySnapshots.capturedAt} DESC`),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500))
    ]);
    if (res) return res;
    return memorySnapshots;
  } catch (err) {
    return memorySnapshots;
  }
}

export async function resetAllStock() {
  memoryProducts = memoryProducts.map((p) => ({
    ...p,
    qty: null,
    packs: null,
    packSize: null,
    loose: null,
    orderQty: null,
  }));
  try {
    await getDb()
      .update(products)
      .set({ qty: null, packs: null, packSize: null, loose: null, orderQty: null });
  } catch (err) {
    console.warn("DB reset fallback to memory:", err);
  }
}

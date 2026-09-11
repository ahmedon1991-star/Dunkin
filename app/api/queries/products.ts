import { asc, eq, sql } from "drizzle-orm";
import { inventorySnapshots, products, type Product, type StockLog } from "@db/schema";
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

const lastStockUpdates: Record<number, StockLog> = {};
const stockLogs: StockLog[] = [];

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
      memoryProducts = res.map((p) => ({
        ...p,
        lastStockUpdate: lastStockUpdates[p.id] || null,
      }));
      return memoryProducts;
    }
    return memoryProducts.map((p) => ({
      ...p,
      lastStockUpdate: lastStockUpdates[p.id] || null,
    }));
  } catch (err) {
    console.warn("DB connection timeout/error, serving fallback 256 products catalog:", err);
    return memoryProducts.map((p) => ({
      ...p,
      lastStockUpdate: lastStockUpdates[p.id] || null,
    }));
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
  meta?: {
    updatedBy?: string;
    branchCode?: string;
  }
) {
  const current = memoryProducts.find((p) => p.id === id);
  if (current) {
    let changedField: "qty" | "packs" | "loose" | null = null;
    let prevQty: number | null = null;
    let newQty: number | null = null;

    if (fields.qty !== undefined && fields.qty !== current.qty) {
      changedField = "qty";
      prevQty = current.qty;
      newQty = fields.qty;
    } else if (fields.packs !== undefined && fields.packs !== current.packs) {
      changedField = "packs";
      prevQty = current.packs;
      newQty = fields.packs;
    } else if (fields.loose !== undefined && fields.loose !== current.loose) {
      changedField = "loose";
      prevQty = current.loose;
      newQty = fields.loose;
    }

    if (changedField && newQty !== null) {
      const pVal = prevQty ?? 0;
      const nVal = newQty ?? 0;
      const delta = nVal - pVal;
      if (delta !== 0) {
        const changeType = delta > 0 ? "increase" : "decrease";
        const log: StockLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: id,
          productCode: current.code,
          productNameAr: current.nameAr,
          productNameEn: current.nameEn,
          field: changedField,
          prevQty,
          newQty,
          delta,
          changeType,
          updatedBy: meta?.updatedBy || "موظف الفرع",
          branchCode: meta?.branchCode || "1011125",
          timestamp: new Date().toISOString(),
        };

        lastStockUpdates[id] = log;
        stockLogs.unshift(log);
        if (stockLogs.length > 500) stockLogs.pop();
      }
    }
  }

  memoryProducts = memoryProducts.map((p) =>
    p.id === id
      ? {
          ...p,
          ...fields,
          updatedAt: new Date(),
          lastStockUpdate: lastStockUpdates[id] ?? p.lastStockUpdate ?? null,
        }
      : p
  );

  try {
    await getDb().update(products).set(fields).where(eq(products.id, id));
  } catch (err) {
    console.warn("DB update fallback to memory:", err);
  }
}

export async function receiveOrderItems(
  items: Array<{
    productId?: number;
    productCode: string;
    orderedQty: number;
    receivedQty: number;
    status: "received_full" | "received_partial" | "not_received";
    notes?: string | null;
  }>,
  meta: {
    receivedBy: string;
    branchCode: string;
    submissionId?: string;
  }
) {
  const updatedItems: Array<{ id: number; prevQty: number; newQty: number; addedQty: number }> = [];

  for (const item of items) {
    const current = memoryProducts.find(
      (p) => (item.productId && p.id === item.productId) || p.code === item.productCode
    );

    if (current) {
      const prevQty = current.qty ?? 0;
      const addedQty = Math.max(0, item.receivedQty);
      const newQty = prevQty + addedQty;

      // Only alter stock qty if items were actually received
      if (addedQty > 0) {
        const log: StockLog = {
          id: `log-recv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: current.id,
          productCode: current.code,
          productNameAr: current.nameAr,
          productNameEn: current.nameEn,
          field: "qty",
          prevQty,
          newQty,
          delta: addedQty,
          changeType: "increase",
          updatedBy: `${meta.receivedBy} (استلام وتوريد طلبية)`,
          branchCode: meta.branchCode,
          timestamp: new Date().toISOString(),
        };

        lastStockUpdates[current.id] = log;
        stockLogs.unshift(log);
        if (stockLogs.length > 500) stockLogs.pop();

        current.qty = newQty;
        current.orderQty = null; // Fulfill order requirement
        current.updatedAt = new Date();
        current.lastStockUpdate = log;

        updatedItems.push({ id: current.id, prevQty, newQty, addedQty });

        try {
          await getDb()
            .update(products)
            .set({ qty: newQty, orderQty: null, updatedAt: new Date() })
            .where(eq(products.id, current.id));
        } catch (err) {
          console.warn("DB update fallback during goods receipt:", err);
        }
      } else if (item.status === "not_received") {
        // Did not arrive: keep current stock, but log notes or optionally keep order
        current.updatedAt = new Date();
      }
    }
  }

  return { ok: true, count: updatedItems.length, updatedItems };
}

export function getStockLogs(productId?: number): StockLog[] {
  if (productId != null) {
    return stockLogs.filter((l) => l.productId === productId);
  }
  return stockLogs;
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

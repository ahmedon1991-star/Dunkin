import { eq, desc } from "drizzle-orm";
import { inventoryAudits, inventoryAuditItems, type InventoryAudit, type InventoryAuditItem } from "@db/schema";
import { getDb } from "./connection";

// ─── Memory Store Fallback ──────────────────────────────────────────────────
let memoryAudits: InventoryAudit[] = [];
let memoryAuditItems: InventoryAuditItem[] = [];
let nextAuditId = 1;
let nextItemId = 1;

async function runWithDbTimeout<T>(operation: () => Promise<T>, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB Timeout")), timeoutMs)),
  ]);
}

// ─── Audit Header CRUD ────────────────────────────────────────────────────────

export async function createAudit(input: {
  auditType: "weekly" | "monthly";
  auditorName: string;
  notes?: string | null;
}): Promise<InventoryAudit> {
  try {
    const res = await runWithDbTimeout(async () => {
      const [row] = await getDb()
        .insert(inventoryAudits)
        .values({
          auditType: input.auditType,
          auditorName: input.auditorName,
          notes: input.notes ?? null,
          status: "draft",
        })
        .returning();
      return row;
    });
    if (res) return res;
  } catch (err) {
    // Database connection or table unavailable, fall back gracefully to memory
  }

  const newAudit: InventoryAudit = {
    id: nextAuditId++,
    auditType: input.auditType,
    auditorName: input.auditorName,
    notes: input.notes ?? null,
    status: "draft",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryAudits.unshift(newAudit);
  return newAudit;
}

export async function listAudits(): Promise<InventoryAudit[]> {
  try {
    const res = await runWithDbTimeout(async () => {
      return getDb()
        .select()
        .from(inventoryAudits)
        .orderBy(desc(inventoryAudits.createdAt));
    });
    if (res && res.length > 0) return res;
  } catch (err) {}

  return [...memoryAudits].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getAudit(id: number): Promise<InventoryAudit | null> {
  try {
    const res = await runWithDbTimeout(async () => {
      const [row] = await getDb()
        .select()
        .from(inventoryAudits)
        .where(eq(inventoryAudits.id, id));
      return row ?? null;
    });
    if (res) return res;
  } catch (err) {}

  return memoryAudits.find((a) => a.id === id) ?? null;
}

export async function finalizeAudit(id: number): Promise<void> {
  try {
    await runWithDbTimeout(async () => {
      await getDb()
        .update(inventoryAudits)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(inventoryAudits.id, id));
    });
  } catch (err) {}

  const audit = memoryAudits.find((a) => a.id === id);
  if (audit) {
    audit.status = "completed";
    audit.updatedAt = new Date();
  }
}

export async function deleteAudit(id: number): Promise<void> {
  try {
    await runWithDbTimeout(async () => {
      await getDb()
        .delete(inventoryAudits)
        .where(eq(inventoryAudits.id, id));
    });
  } catch (err) {}

  memoryAudits = memoryAudits.filter((a) => a.id !== id);
  memoryAuditItems = memoryAuditItems.filter((item) => item.auditId !== id);
}

// ─── Audit Items CRUD ─────────────────────────────────────────────────────────

export async function getAuditItems(auditId: number): Promise<InventoryAuditItem[]> {
  try {
    const res = await runWithDbTimeout(async () => {
      return getDb()
        .select()
        .from(inventoryAuditItems)
        .where(eq(inventoryAuditItems.auditId, auditId));
    });
    if (res && res.length > 0) return res;
  } catch (err) {}

  return memoryAuditItems.filter((item) => item.auditId === auditId);
}

export async function upsertAuditItems(
  auditId: number,
  items: Array<{
    productCode: string;
    productName: string;
    category: string;
    unit: string;
    systemQty: number | null;
    actualQty: number | null;
    itemNotes?: string | null;
  }>,
): Promise<void> {
  if (items.length === 0) return;

  const rows: InventoryAuditItem[] = items.map((item) => ({
    id: nextItemId++,
    auditId,
    productCode: item.productCode,
    productName: item.productName,
    category: item.category,
    unit: item.unit,
    systemQty: item.systemQty ?? null,
    actualQty: item.actualQty ?? null,
    difference:
      item.actualQty != null && item.systemQty != null
        ? item.actualQty - item.systemQty
        : null,
    itemNotes: item.itemNotes ?? null,
  }));

  try {
    await runWithDbTimeout(async () => {
      await getDb()
        .delete(inventoryAuditItems)
        .where(eq(inventoryAuditItems.auditId, auditId));
      await getDb().insert(inventoryAuditItems).values(rows);
    });
  } catch (err) {}

  // Always keep in-memory items in sync
  memoryAuditItems = memoryAuditItems.filter((item) => item.auditId !== auditId);
  memoryAuditItems.push(...rows);
}

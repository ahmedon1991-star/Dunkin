import { eq, desc } from "drizzle-orm";
import { inventoryAudits, inventoryAuditItems } from "@db/schema";
import { getDb } from "./connection";

// ─── Audit Header CRUD ────────────────────────────────────────────────────────

export async function createAudit(input: {
  auditType: "weekly" | "monthly";
  auditorName: string;
  notes?: string | null;
}) {
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
}

export async function listAudits() {
  return getDb()
    .select()
    .from(inventoryAudits)
    .orderBy(desc(inventoryAudits.createdAt));
}

export async function getAudit(id: number) {
  const [row] = await getDb()
    .select()
    .from(inventoryAudits)
    .where(eq(inventoryAudits.id, id));
  return row ?? null;
}

export async function finalizeAudit(id: number) {
  await getDb()
    .update(inventoryAudits)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(inventoryAudits.id, id));
}

export async function deleteAudit(id: number) {
  await getDb()
    .delete(inventoryAudits)
    .where(eq(inventoryAudits.id, id));
}

// ─── Audit Items CRUD ─────────────────────────────────────────────────────────

export async function getAuditItems(auditId: number) {
  return getDb()
    .select()
    .from(inventoryAuditItems)
    .where(eq(inventoryAuditItems.auditId, auditId));
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
) {
  if (items.length === 0) return;

  // Delete existing items for this audit then re-insert (simple upsert strategy)
  await getDb()
    .delete(inventoryAuditItems)
    .where(eq(inventoryAuditItems.auditId, auditId));

  const rows = items.map((item) => ({
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

  await getDb().insert(inventoryAuditItems).values(rows);
}

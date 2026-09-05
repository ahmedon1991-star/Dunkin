import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import {
  createAudit,
  listAudits,
  getAudit,
  getAuditItems,
  upsertAuditItems,
  finalizeAudit,
  deleteAudit,
} from "./queries/audits";

const auditItemSchema = z.object({
  productCode: z.string().min(1),
  productName: z.string().min(1),
  category: z.string().min(1),
  unit: z.string().min(1),
  systemQty: z.number().int().nullable(),
  actualQty: z.number().int().nullable(),
  itemNotes: z.string().nullable().optional(),
});

export const auditRouter = createRouter({
  /** إنشاء جرد جديد (مسودة) */
  create: publicQuery
    .input(
      z.object({
        auditType: z.enum(["weekly", "monthly"]),
        auditorName: z.string().min(1),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const audit = await createAudit(input);
      return audit;
    }),

  /** قائمة جميع الجرود */
  list: publicQuery.query(() => listAudits()),

  /** تفاصيل جرد واحد مع بنوده */
  get: publicQuery
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const audit = await getAudit(input.id);
      if (!audit) throw new Error("الجرد غير موجود");
      const items = await getAuditItems(input.id);
      return { audit, items };
    }),

  /** حفظ / تحديث البنود كمسودة */
  saveDraft: publicQuery
    .input(
      z.object({
        auditId: z.number().int(),
        items: z.array(auditItemSchema),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await upsertAuditItems(input.auditId, input.items);
      return { ok: true };
    }),

  /** اعتماد الجرد نهائياً */
  finalize: publicQuery
    .input(
      z.object({
        auditId: z.number().int(),
        items: z.array(auditItemSchema),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await upsertAuditItems(input.auditId, input.items);
      await finalizeAudit(input.auditId);
      return { ok: true };
    }),

  /** حذف جرد */
  delete: publicQuery
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await deleteAudit(input.id);
      return { ok: true };
    }),
});

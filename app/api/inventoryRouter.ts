import { z } from "zod";
import { createRouter, publicQuery, protectedProcedure, adminProcedure } from "./middleware";
import {
  listProducts,
  updateProduct,
  addProduct,
  editProduct,
  deleteProduct,
  saveInventorySnapshot,
  listInventorySnapshots,
  resetAllStock,
  getStockLogs,
} from "./queries/products";

const unitCode = z.enum(["CTN", "PKT", "PCS"]);
const optionalNullableImageUrl = z.preprocess((value) => {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}, z.union([z.string().url(), z.null()]).optional());

export const inventoryRouter = createRouter({
  /** عرض المنتجات متاح للعرض */
  list: publicQuery.query(() => listProducts()),

  /** تحديث الكمية يتطلب جلسة موثقة */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        mode: z.enum(["simple", "detailed"]).optional(),
        qty: z.number().int().min(0).nullable().optional(),
        packs: z.number().int().min(0).nullable().optional(),
        packSize: z.number().int().min(0).nullable().optional(),
        loose: z.number().int().min(0).nullable().optional(),
        orderQty: z.number().int().min(0).nullable().optional(),
        updatedBy: z.string().optional(),
        branchCode: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, updatedBy, branchCode, ...fields } = input;
      // Auto-bind author to verified session if available
      const author = ctx.user?.fullName || updatedBy || "موظف الفرع";
      const branch = ctx.user?.branchCode || branchCode || "1011125";
      await updateProduct(id, fields, { updatedBy: author, branchCode: branch });
      return { ok: true };
    }),

  stockLogs: publicQuery
    .input(z.object({ productId: z.number().optional() }).optional())
    .query(({ input }) => getStockLogs(input?.productId)),

  /** إضافة منتج: مخصص لمدير النظام (الأدمن) فقط */
  add: adminProcedure
    .input(
      z.object({
        code: z.string().min(1),
        nameAr: z.string().min(1),
        nameEn: z.string().min(1),
        category: z.string().min(1),
        mode: z.enum(["simple", "detailed"]),
        unitCode,
        unitLabel: z.string().min(1),
        imageUrl: optionalNullableImageUrl,
      }),
    )
    .mutation(async ({ input }) => {
      await addProduct(input);
      return { ok: true };
    }),

  /** تعديل منتج: مخصص لمدير النظام (الأدمن) فقط */
  edit: adminProcedure
    .input(
      z.object({
        id: z.number(),
        code: z.string().min(1).optional(),
        nameAr: z.string().min(1).optional(),
        nameEn: z.string().min(1).optional(),
        category: z.string().min(1).optional(),
        mode: z.enum(["simple", "detailed"]).optional(),
        unitCode: unitCode.optional(),
        unitLabel: z.string().min(1).optional(),
        imageUrl: optionalNullableImageUrl,
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;
      await editProduct(id, fields);
      return { ok: true };
    }),

  /** حذف منتج: مخصص لمدير النظام (الأدمن) فقط */
  remove: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteProduct(input.id);
      return { ok: true };
    }),

  snapshots: protectedProcedure.query(() => listInventorySnapshots()),

  saveSnapshot: protectedProcedure
    .input(z.object({ period: z.enum(["weekly", "monthly"]), data: z.string().min(2) }))
    .mutation(async ({ input }) => {
      await saveInventorySnapshot(input.period, input.data);
      return { ok: true };
    }),

  /** تصفير المخزون: محمي بأعلى مستوى صلاحية (الأدمن فقط) */
  resetAll: adminProcedure.mutation(async () => {
    await resetAllStock();
    return { ok: true };
  }),
});

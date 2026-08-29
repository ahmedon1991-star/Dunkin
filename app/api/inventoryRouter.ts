import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import {
  listProducts,
  updateProduct,
  addProduct,
  editProduct,
  deleteProduct,
  saveInventorySnapshot,
  listInventorySnapshots,
  resetAllStock,
} from "./queries/products";

const unitCode = z.enum(["CTN", "PKT", "PCS"]);

export const inventoryRouter = createRouter({
  list: publicQuery.query(() => listProducts()),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        mode: z.enum(["simple", "detailed"]).optional(),
        qty: z.number().int().min(0).nullable().optional(),
        packs: z.number().int().min(0).nullable().optional(),
        packSize: z.number().int().min(0).nullable().optional(),
        loose: z.number().int().min(0).nullable().optional(),
        orderQty: z.number().int().min(0).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;
      await updateProduct(id, fields);
      return { ok: true };
    }),

  add: publicQuery
    .input(
      z.object({
        code: z.string().min(1),
        nameAr: z.string().min(1),
        nameEn: z.string().min(1),
        category: z.string().min(1),
        mode: z.enum(["simple", "detailed"]),
        unitCode,
        unitLabel: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      await addProduct(input);
      return { ok: true };
    }),

  edit: publicQuery
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
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;
      await editProduct(id, fields);
      return { ok: true };
    }),

  remove: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteProduct(input.id);
      return { ok: true };
    }),

  snapshots: publicQuery.query(() => listInventorySnapshots()),

  saveSnapshot: publicQuery
    .input(z.object({ period: z.enum(["weekly", "monthly"]), data: z.string().min(2) }))
    .mutation(async ({ input }) => {
      await saveInventorySnapshot(input.period, input.data);
      return { ok: true };
    }),

  resetAll: publicQuery.mutation(async () => {
    await resetAllStock();
    return { ok: true };
  }),
});

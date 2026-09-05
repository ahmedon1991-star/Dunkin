import { createRouter, publicQuery } from "./middleware";
import { inventoryRouter } from "./inventoryRouter";
import { auditRouter } from "./auditRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  inventory: inventoryRouter,
  audit: auditRouter,
});

export type AppRouter = typeof appRouter;

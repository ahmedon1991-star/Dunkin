import { createRouter, publicQuery } from "./middleware";
import { inventoryRouter } from "./inventoryRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  inventory: inventoryRouter,
});

export type AppRouter = typeof appRouter;

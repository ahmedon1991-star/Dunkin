import { getDb } from "../api/queries/connection";
import { products } from "./schema";
import { seedProducts } from "./seedData";

function toNullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function seed() {
  const db = getDb();
  console.log("Seeding full product catalog...");

  await db.delete(products);

  const rows = seedProducts.map((p, index) => ({
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
    sortOrder: index + 1,
  }));

  await db.insert(products).values(rows);

  console.log(`Seeded ${rows.length} products. Done.`);
  process.exit(0);
}

seed();

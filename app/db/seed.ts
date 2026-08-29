import { getDb } from "../api/queries/connection";
import { products } from "./schema";
import { seedProducts } from "./seedData";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length > 0) {
    console.log("Products already seeded, skipping.");
    process.exit(0);
  }

  await db.insert(products).values(
    seedProducts.map((p, i) => ({
      code: p.code,
      nameAr: p.name_ar,
      nameEn: p.name_en,
      category: p.category,
      mode: p.mode as "simple" | "detailed",
      unitCode: p.unit_code as "CTN" | "PKT" | "PCS",
      unitLabel: p.unit_label,
      sortOrder: i,
    })),
  );

  console.log(`Seeded ${seedProducts.length} products. Done.`);
  process.exit(0);
}

seed();

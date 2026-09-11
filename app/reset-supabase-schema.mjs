import "dotenv/config";
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}
const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1, idle_timeout: 10 });

const seedProducts = [
  {
    code: '15041002',
    name_ar: 'مريلة زي موحد دانكن',
    name_en: 'UNIFORM.APRON DD',
    category: 'زي الموظفين (Uniform)',
    mode: 'simple',
    qty: 12,
    packs: 2,
    pack_size: 6,
    loose: 0,
    order_qty: 4,
    unit_code: 'PCS',
    unit_label: 'حبة (PCS)',
    sort_order: 1,
  },
  {
    code: '10123003',
    name_ar: 'ساندوتش بيغل قرفة دانكن',
    name_en: 'SANDWICH.DD BAGEL CINNAMON',
    category: 'مخبوزات وساندوتشات',
    mode: 'simple',
    qty: 18,
    packs: 3,
    pack_size: 6,
    loose: 0,
    order_qty: 5,
    unit_code: 'CTN',
    unit_label: 'كرتون (CTN)',
    sort_order: 2,
  },
  {
    code: '12023009',
    name_ar: 'مافن التوت الأزرق',
    name_en: 'BLUEBERRY MUFFIN',
    category: 'كيك وكوكيز ومافن',
    mode: 'detailed',
    qty: 20,
    packs: 4,
    pack_size: 5,
    loose: 0,
    order_qty: 8,
    unit_code: 'PCS',
    unit_label: 'حبة (PCS)',
    sort_order: 3,
  },
  {
    code: '14011001',
    name_ar: 'مكنسة بلاستيك ناعمة',
    name_en: 'DISPOSABLES.SOFT PLASTIC BROOM',
    category: 'مستلزمات ونظافة',
    mode: 'simple',
    qty: 10,
    packs: 2,
    pack_size: 5,
    loose: 0,
    order_qty: 3,
    unit_code: 'PCS',
    unit_label: 'حبة (PCS)',
    sort_order: 4,
  },
  {
    code: '17021014',
    name_ar: 'أكواب ورقية',
    name_en: 'PAPER CUPS',
    category: 'أدوات تقديم',
    mode: 'simple',
    qty: 40,
    packs: 8,
    pack_size: 5,
    loose: 0,
    order_qty: 12,
    unit_code: 'PKT',
    unit_label: 'بكيت (PKT)',
    sort_order: 5,
  },
];

try {
  await sql`DROP TABLE IF EXISTS inventory_snapshots;`;
  await sql`DROP TABLE IF EXISTS products;`;

  await sql`
    CREATE TABLE products (
      id SERIAL PRIMARY KEY,
      code VARCHAR(64) NOT NULL UNIQUE,
      name_ar VARCHAR(512) NOT NULL,
      name_en VARCHAR(512) NOT NULL,
      category VARCHAR(255) NOT NULL,
      mode VARCHAR(20) NOT NULL DEFAULT 'simple',
      qty INTEGER,
      packs INTEGER,
      pack_size INTEGER,
      loose INTEGER,
      order_qty INTEGER,
      unit_code VARCHAR(10) NOT NULL,
      unit_label VARCHAR(64) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE inventory_snapshots (
      id SERIAL PRIMARY KEY,
      period VARCHAR(20) NOT NULL,
      captured_at TIMESTAMP NOT NULL DEFAULT NOW(),
      data TEXT NOT NULL
    );
  `;

  await sql`
    INSERT INTO products (
      code,
      name_ar,
      name_en,
      category,
      mode,
      qty,
      packs,
      pack_size,
      loose,
      order_qty,
      unit_code,
      unit_label,
      sort_order
    ) VALUES ${sql(seedProducts.map((p) => [
      p.code,
      p.name_ar,
      p.name_en,
      p.category,
      p.mode,
      p.qty,
      p.packs,
      p.pack_size,
      p.loose,
      p.order_qty,
      p.unit_code,
      p.unit_label,
      p.sort_order,
    ]))};
  `;

  const result = await sql`SELECT * FROM products ORDER BY sort_order`;
  console.log('Seeded rows:', JSON.stringify(result, null, 2));
} catch (error) {
  console.error('RESET_ERROR');
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end();
}

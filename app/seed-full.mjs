import fs from 'node:fs';
import postgres from 'postgres';

const source = fs.readFileSync('./db/seedData.ts', 'utf8');
const match = source.match(/export const seedProducts = ([\s\S]*?);\s*$/m);

if (!match) {
  throw new Error('Could not find seedProducts in db/seedData.ts');
}

const payload = match[1].replace(/\s*as const\s*$/, '').trim();
const seedProducts = Function(`return (${payload});`)();

const sql = postgres('postgresql://postgres:Aa11788%4011788@db.hipgihzbfjdlnqxoikyv.supabase.co:5432/postgres', {
  ssl: 'require',
  max: 1,
  idle_timeout: 10,
});

const rows = seedProducts.map((product, index) => ({
  code: String(product.code),
  name_ar: String(product.name_ar),
  name_en: String(product.name_en),
  category: String(product.category),
  mode: product.mode === 'detailed' ? 'detailed' : 'simple',
  qty: product.qty === '' || product.qty == null ? null : Number(product.qty),
  packs: product.packs === '' || product.packs == null ? null : Number(product.packs),
  pack_size: product.pack_size === '' || product.pack_size == null ? null : Number(product.pack_size),
  loose: product.loose === '' || product.loose == null ? null : Number(product.loose),
  order_qty: null,
  unit_code: ['CTN', 'PKT', 'PCS'].includes(product.unit_code) ? product.unit_code : 'PCS',
  unit_label: String(product.unit_label || product.unit || 'حبة (PCS)'),
  sort_order: index + 1,
}));

await sql`DELETE FROM products;`;
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
  ) VALUES ${sql(rows.map((row) => [
    row.code,
    row.name_ar,
    row.name_en,
    row.category,
    row.mode,
    row.qty,
    row.packs,
    row.pack_size,
    row.loose,
    row.order_qty,
    row.unit_code,
    row.unit_label,
    row.sort_order,
  ]))}
`;

const count = await sql`SELECT COUNT(*)::int AS total FROM products`;
console.log(JSON.stringify({ total: count[0].total, first: rows[0], last: rows[rows.length - 1] }, null, 2));

await sql.end();

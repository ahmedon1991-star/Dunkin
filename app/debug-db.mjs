import postgres from 'postgres';

const DATABASE_URL = 'postgresql://postgres:Aa11788%4011788@db.hipgihzbfjdlnqxoikyv.supabase.co:5432/postgres';
const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1, idle_timeout: 10 });

try {
  console.log('Checking tables...');
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name`;
  console.log(JSON.stringify(tables, null, 2));

  console.log('Checking products columns...');
  const columns = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position`;
  console.log(JSON.stringify(columns, null, 2));

  console.log('Checking products...');
  const products = await sql`SELECT * FROM products LIMIT 5`;
  console.log(JSON.stringify(products, null, 2));
} catch (e) {
  console.error('DB_ERROR');
  console.error(e);
  process.exitCode = 1;
} finally {
  await sql.end();
}

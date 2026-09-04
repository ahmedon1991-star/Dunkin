import postgres from 'postgres';

const DATABASE_URL = 'postgresql://postgres:Aa11788%4011788@db.hipgihzbfjdlnqxoikyv.supabase.co:5432/postgres';
const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1, idle_timeout: 10 });

try {
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(1024);`;
  const columns = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position`;
  console.log(JSON.stringify(columns, null, 2));
  console.log('image_url column ensured successfully');
} catch (error) {
  console.error('DB_ERROR');
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end();
}

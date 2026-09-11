import "dotenv/config";
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}
const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1, idle_timeout: 10 });

try {
  await sql`DROP TABLE IF EXISTS order_items CASCADE`;
  await sql`DROP TABLE IF EXISTS inventory_history CASCADE`;
  await sql`DROP TABLE IF EXISTS inventory CASCADE`;
  await sql`DROP TABLE IF EXISTS products CASCADE`;
  await sql`DROP TABLE IF EXISTS inventory_snapshots CASCADE`;
  console.log('Dropped conflicting tables');
} catch (error) {
  console.error('DROP_ERROR');
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end();
}

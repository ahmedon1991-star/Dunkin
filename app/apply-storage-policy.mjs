import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}
const sql = postgres(connectionString, { ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    console.log("Connecting to Supabase PostgreSQL database...");
    
    // Drop existing policy if any
    await sql`DROP POLICY IF EXISTS "Public Access product-images" ON storage.objects;`;
    
    // Create full access policy for bucket 'product-images'
    await sql`
      CREATE POLICY "Public Access product-images" ON storage.objects
      FOR ALL
      TO public
      USING (bucket_id = 'product-images')
      WITH CHECK (bucket_id = 'product-images');
    `;
    
    console.log("SUCCESS: Storage policy 'Public Access product-images' created successfully!");
  } catch (error) {
    console.error("Error creating storage policy:", error);
  } finally {
    await sql.end();
  }
}

run();

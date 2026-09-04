import postgres from "postgres";

const connectionString = "postgresql://postgres:Aa11788%4011788@db.hipgihzbfjdlnqxoikyv.supabase.co:5432/postgres";
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

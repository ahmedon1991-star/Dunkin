import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

export async function uploadProductImage(file: File) {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("placeholder") || supabaseAnonKey.includes("placeholder")) {
    throw new Error("قم بإضافة VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في ملف .env أولاً.");
  }

  const safeName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = `product-images/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from("product-images").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return `${supabaseUrl}/storage/v1/object/public/product-images/${filePath}`;
}

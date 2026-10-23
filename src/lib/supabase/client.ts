import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

let client: SupabaseClient<Database> | undefined;

/** Tarayıcıda kullanılan tekil Supabase istemcisi. Oturum localStorage'da saklanır. */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client;

  // NEXT_PUBLIC_ değişkenleri derleme sırasında koda gömülür; bu yüzden doğrudan okunmalı.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı değil. .env.example dosyasına bak.",
    );
  }

  client = createClient<Database>(url, key);
  return client;
}

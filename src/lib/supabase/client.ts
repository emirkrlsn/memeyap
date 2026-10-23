import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type TypedSupabaseClient = SupabaseClient<Database>;

let client: TypedSupabaseClient | undefined;

/** Tarayıcıda kullanılan tekil Supabase istemcisi. */
export function getSupabaseClient(): TypedSupabaseClient {
  if (client) return client;

  // NEXT_PUBLIC_ değişkenleri derleme sırasında koda gömülür; bu yüzden doğrudan okunmalı.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı değil. .env.example dosyasına bak.",
    );
  }

  client = createClient<Database>(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

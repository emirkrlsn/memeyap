import type { User } from "@supabase/supabase-js";

import { getSupabaseClient } from "./client";

let pending: Promise<User> | undefined;

/**
 * Mevcut anonim oturumu döner; yoksa yeni bir anonim kullanıcı oluşturur.
 * Aynı anda birden çok çağrı gelirse (ör. React Strict Mode) tek bir kullanıcı oluşturulur.
 */
export function ensureAnonymousSession(): Promise<User> {
  pending ??= signIn().finally(() => {
    pending = undefined;
  });
  return pending;
}

async function signIn(): Promise<User> {
  const supabase = getSupabaseClient();

  const { data: sessionData } = await supabase.auth.getSession();
  let user = sessionData.session?.user;
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (!data.user) throw new Error("Anonim oturum açılamadı.");
    user = data.user;
  }

  console.info("[MemeYap] Anonim kullanıcı kimliği:", user.id);
  return user;
}

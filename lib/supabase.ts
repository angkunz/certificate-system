import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  return url;
}

function getAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  return key;
}

function getServiceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  return key;
}

// Lazy singleton instances
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

// Public client (frontend)
export function getSupabase(): SupabaseClient {
  if (!_supabase) _supabase = createClient(getSupabaseUrl(), getAnonKey());
  return _supabase;
}

// Admin client (server-side, bypasses RLS)
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(getSupabaseUrl(), getServiceKey(), {
      auth: { persistSession: false },
    });
  }
  return _supabaseAdmin;
}

// Convenience re-exports as getters
export const supabase = new Proxy({} as SupabaseClient, { get: (_, prop) => (getSupabase() as unknown as Record<string | symbol, unknown>)[prop] });
export const supabaseAdmin = new Proxy({} as SupabaseClient, { get: (_, prop) => (getSupabaseAdmin() as unknown as Record<string | symbol, unknown>)[prop] });

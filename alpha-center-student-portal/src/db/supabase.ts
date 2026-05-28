import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

const isUrlValid = SUPABASE_URL && SUPABASE_URL.startsWith('https://');
const isKeyValid = SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 40;

export function isSupabaseConfigured(): boolean {
  return Boolean(isUrlValid && isKeyValid);
}

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}

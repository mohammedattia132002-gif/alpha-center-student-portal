import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isUrlValid = supabaseUrl && supabaseUrl.startsWith('https://') && !supabaseUrl.includes('your-project') && !supabaseUrl.includes('placeholder');
const isKeyValid = supabaseAnonKey && (supabaseAnonKey.length > 40 || supabaseAnonKey.startsWith('sb_publishable_'));

export const isSupabaseConfigured = Boolean(isUrlValid && isKeyValid);

console.log('[Supabase] Config:', { url: supabaseUrl, keyLength: supabaseAnonKey?.length, isUrlValid, isKeyValid });

// Create the real Supabase client
export const supabase = createClient(
  isUrlValid ? supabaseUrl : 'https://placeholder.supabase.co',
  isKeyValid ? supabaseAnonKey : 'placeholder-key'
);

let sessionInitPromise: Promise<boolean> | null = null;

export async function ensurePortalSupabaseSession(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  if (sessionInitPromise) return sessionInitPromise;

  sessionInitPromise = (async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (sessionData.session) return true;

      // Personal single-center deployment: the portal reads with the anon key directly
      // and does not require anonymous auth bootstrap to proceed.
      return true;
    } catch (error) {
      console.error('[Supabase] Failed to initialize portal auth session:', error);
      return true;
    }
  })();

  const ready = await sessionInitPromise;
  return ready;
}

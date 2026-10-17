import { createClient } from '@supabase/supabase-js';
import { config } from './index.js';

let client;
export function getSupabase() {
  if (!client) {
    client = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

import 'react-native-url-polyfill/auto';
import './auth-crypto';
import { createClient, processLock } from '@supabase/supabase-js';
import { config, isCloudConfigured } from '@/shared/config';
import { authStorage } from './auth-storage';
export const supabase = isCloudConfigured
  ? createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        storage: authStorage,
        storageKey: 'mygarage.auth.v1',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        lock: processLock,
      },
    })
  : null;
export function requireCloud() {
  if (!supabase) throw new Error('Cloud is not configured');
  return supabase;
}

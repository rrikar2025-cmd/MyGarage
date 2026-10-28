import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
export const useSession = create<{
  session: Session | null;
  recoveryUser: string | null;
  setRecovery: (id: string | null) => void;
  ready: boolean;
  error: boolean;
  set: (session: Session | null, error?: boolean) => void;
}>((set) => ({
  session: null,
  recoveryUser: null,
  setRecovery: (recoveryUser) => set({ recoveryUser }),
  ready: false,
  error: false,
  set: (session, error = false) =>
    set((state) => ({
      session,
      ready: true,
      error,
      recoveryUser: session?.user.id === state.recoveryUser ? state.recoveryUser : null,
    })),
}));

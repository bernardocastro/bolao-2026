import { create } from 'zustand';
import type { PublicUser } from '@/server/auth/auth.dto';

interface UserState {
  user: PublicUser | null;
  setUser: (user: PublicUser | null) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

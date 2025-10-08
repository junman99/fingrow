import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthState = {
  isSignedIn: boolean;
  hydrated: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
};

const KEY = 'fingrow:auth:v1';

export const useAuthStore = create<AuthState>((set, get) => ({
  isSignedIn: false,
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const { isSignedIn } = JSON.parse(raw);
        set({ isSignedIn: !!isSignedIn, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
  signIn: async () => {
    set({ isSignedIn: true });
    try { await AsyncStorage.setItem(KEY, JSON.stringify({ isSignedIn: true })); } catch {}
  },
  signOut: async () => {
    set({ isSignedIn: false });
    try { await AsyncStorage.setItem(KEY, JSON.stringify({ isSignedIn: false })); } catch {}
  },
}));
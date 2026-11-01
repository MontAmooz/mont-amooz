"use client";

// مُنت‌آموز — global client state (zustand): session user + auth dialog.

import { create } from "zustand";
import { api } from "@/lib/client";
import type { PublicUser } from "@/lib/types";

interface EduState {
  user: PublicUser | null;
  /** True once the initial /auth/me check has resolved (avoid auth-flashes). */
  sessionLoaded: boolean;
  authOpen: boolean;
  /** Optional Persian hint shown inside the auth dialog (why login is needed). */
  authHint: string | null;
  setUser: (user: PublicUser | null) => void;
  markSessionLoaded: () => void;
  openAuth: (hint?: string) => void;
  closeAuth: () => void;
}

export const useEduStore = create<EduState>((set) => ({
  user: null,
  sessionLoaded: false,
  authOpen: false,
  authHint: null,
  setUser: (user) => set({ user, sessionLoaded: true }),
  markSessionLoaded: () => set({ sessionLoaded: true }),
  openAuth: (hint) => set({ authOpen: true, authHint: hint ?? null }),
  closeAuth: () => set({ authOpen: false, authHint: null }),
}));

/** Fetch the current session (called once on app mount; 401 → anonymous). */
export async function refreshSession(): Promise<void> {
  try {
    const { user } = await api<{ user: PublicUser }>("/auth/me");
    useEduStore.getState().setUser(user);
  } catch {
    useEduStore.getState().setUser(null);
  }
}

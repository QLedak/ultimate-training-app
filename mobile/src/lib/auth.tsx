import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { api, ApiError } from "./api";
import type { Athlete } from "../types";

type AuthState = {
  loading: boolean;
  session: Session | null;
  athlete: Athlete | null;
  /** Signed in, but no athlete profile yet (finish intake on the web). */
  noAthlete: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [noAthlete, setNoAthlete] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setProfileError(null);
    try {
      const d = await api<{ athlete: Athlete }>("/api/me/athlete");
      setAthlete(d.athlete);
      setNoAthlete(false);
    } catch (e) {
      setAthlete(null);
      if (e instanceof ApiError && e.status === 404) setNoAthlete(true);
      else setProfileError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session) await loadProfile();
      if (alive) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setAthlete(null);
        setNoAthlete(false);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return error.message;
      await loadProfile();
      return null;
    },
    [loadProfile]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <Ctx.Provider value={{ loading, session, athlete, noAthlete, profileError, signIn, signOut, refreshProfile: loadProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

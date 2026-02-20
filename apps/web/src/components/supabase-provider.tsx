"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type AuthContext = {
	user: User | null;
	session: Session | null;
	isLoading: boolean;
	signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthContext | undefined>(undefined);

export function SupabaseProvider({ children }: { children: ReactNode }) {
	const supabase = useMemo(() => createClient(), []);
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		// Get initial session
		supabase.auth.getSession().then(({ data: { session: s } }) => {
			setSession(s);
			setUser(s?.user ?? null);
			setIsLoading(false);
		});

		// Listen for auth state changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, s) => {
			setSession(s);
			setUser(s?.user ?? null);
			setIsLoading(false);
		});

		return () => subscription.unsubscribe();
	}, [supabase]);

	const signOut = async () => {
		await supabase.auth.signOut();
	};

	const value = useMemo(
		() => ({ user, session, isLoading, signOut }),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[user, session, isLoading],
	);

	return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
	const ctx = useContext(AuthCtx);
	if (!ctx) throw new Error("useAuth must be used within <SupabaseProvider>");
	return ctx;
}

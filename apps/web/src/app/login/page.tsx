"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const WEB_BASE_PATH = "/workout";

function isFeatureEnabled(value: string | undefined): boolean {
	if (value === "true") return true;
	if (value === "false") return false;
	return process.env.NODE_ENV === "development";
}

const showGoogleAuth = isFeatureEnabled(process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH);
const showDemo = isFeatureEnabled(process.env.NEXT_PUBLIC_ENABLE_DEMO);

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [mode, setMode] = useState<"signin" | "signup">("signin");
	const [signUpSuccess, setSignUpSuccess] = useState(false);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		const supabase = createClient();

		if (mode === "signup") {
			const callbackUrl = `${window.location.origin}${WEB_BASE_PATH}/auth/callback`;
			const { error: signUpError } = await supabase.auth.signUp({
				email,
				password,
				options: {
					emailRedirectTo: callbackUrl,
				},
			});

			if (signUpError) {
				setError(signUpError.message);
				setLoading(false);
				return;
			}

			setSignUpSuccess(true);
			setLoading(false);
			return;
		}

		const { error: authError } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (authError) {
			setError(authError.message);
			setLoading(false);
			return;
		}

		router.push("/dashboard");
		router.refresh();
	};

	const handleGoogleSignIn = async () => {
		setError(null);
		setLoading(true);

		const supabase = createClient();
		const callbackUrl = `${window.location.origin}${WEB_BASE_PATH}/auth/callback`;
		const { error: oauthError } = await supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo: callbackUrl,
			},
		});

		if (oauthError) {
			setError(oauthError.message);
			setLoading(false);
		}
	};

	const handleDemoLogin = async () => {
		if (!showDemo) return;
		setError(null);
		setLoading(true);

		const supabase = createClient();
		const { error: demoError } = await supabase.auth.signInWithPassword({
			email: "demo@jpx.nu",
			password: "demo1234",
		});

		if (demoError) {
			setError(demoError.message);
			setLoading(false);
			return;
		}

		router.push("/dashboard");
		router.refresh();
	};

	return (
		<div
			className="flex min-h-screen items-center justify-center p-4"
			style={{ background: "var(--color-bg-primary)" }}
		>
			<div className="glass-card w-full max-w-sm p-8 space-y-6">
				{/* Logo header */}
				<div className="text-center space-y-2">
					<div
						className="inline-flex w-12 h-12 rounded-xl items-center justify-center text-base font-bold mx-auto"
						style={{
							background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
						}}
					>
						TRI
					</div>
					<h1 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
						Triathlon AI
					</h1>
					<p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
						{mode === "signin"
							? "Sign in to your coaching dashboard"
							: "Create your coaching account"}
					</p>
				</div>

				{/* Sign-up success message */}
				{signUpSuccess && (
					<div
						className="rounded-lg px-4 py-3 text-sm text-center"
						style={{
							background: "oklch(0.40 0.12 145 / 0.15)",
							color: "oklch(0.70 0.15 145)",
							border: "1px solid oklch(0.40 0.12 145 / 0.25)",
						}}
					>
						<strong>Check your email!</strong>
						<br />
						We sent you a confirmation link to get started.
					</div>
				)}

				{/* Error banner */}
				{error && (
					<div
						className="rounded-lg px-4 py-3 text-sm"
						style={{
							background: "oklch(0.40 0.12 25 / 0.15)",
							color: "oklch(0.70 0.15 25)",
							border: "1px solid oklch(0.40 0.12 25 / 0.25)",
						}}
					>
						{error}
					</div>
				)}

				{!signUpSuccess && (
					<>
						{/* Demo login */}
						{showDemo && (
							<>
								<button
									type="button"
									onClick={handleDemoLogin}
									disabled={loading}
									className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
									style={{
										background:
											"linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
									}}
								>
									🚀 Try Demo — No account needed
								</button>

								<div className="flex items-center gap-3">
									<div
										className="flex-1 h-px"
										style={{ background: "var(--color-glass-border)" }}
									/>
									<span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
										or sign in
									</span>
									<div
										className="flex-1 h-px"
										style={{ background: "var(--color-glass-border)" }}
									/>
								</div>
							</>
						)}

						{/* Google OAuth — hidden until provider is approved */}
						{showGoogleAuth && (
							<>
								<button
									type="button"
									onClick={handleGoogleSignIn}
									disabled={loading}
									className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3"
									style={{
										background: "var(--color-glass-surface)",
										border: "1px solid var(--color-glass-border)",
										color: "var(--color-text-primary)",
									}}
								>
									<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
										<path
											d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
											fill="#4285F4"
										/>
										<path
											d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
											fill="#34A853"
										/>
										<path
											d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
											fill="#FBBC05"
										/>
										<path
											d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
											fill="#EA4335"
										/>
									</svg>
									Continue with Google
								</button>

								<div className="flex items-center gap-3">
									<div
										className="flex-1 h-px"
										style={{ background: "var(--color-glass-border)" }}
									/>
									<span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
										or
									</span>
									<div
										className="flex-1 h-px"
										style={{ background: "var(--color-glass-border)" }}
									/>
								</div>
							</>
						)}

						{/* Email form */}
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-1.5">
								<label
									htmlFor="email"
									className="block text-xs font-medium"
									style={{ color: "var(--color-text-secondary)" }}
								>
									Email
								</label>
								<input
									id="email"
									type="email"
									autoComplete="email"
									required
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all duration-200"
									style={{
										background: "var(--color-glass-surface)",
										border: "1px solid var(--color-glass-border)",
										color: "var(--color-text-primary)",
									}}
									placeholder="you@example.com"
								/>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="password"
									className="block text-xs font-medium"
									style={{ color: "var(--color-text-secondary)" }}
								>
									Password
								</label>
								<input
									id="password"
									type="password"
									autoComplete={mode === "signup" ? "new-password" : "current-password"}
									required
									minLength={mode === "signup" ? 6 : undefined}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all duration-200"
									style={{
										background: "var(--color-glass-surface)",
										border: "1px solid var(--color-glass-border)",
										color: "var(--color-text-primary)",
									}}
									placeholder="••••••••"
								/>
							</div>

							<button
								type="submit"
								disabled={loading}
								className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50"
								style={{
									background:
										"linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
								}}
							>
								{loading
									? mode === "signin"
										? "Signing in…"
										: "Creating account…"
									: mode === "signin"
										? "Sign in"
										: "Create account"}
							</button>
						</form>

						{/* Toggle sign-in / sign-up */}
						<p className="text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
							{mode === "signin" ? (
								<>
									Don&apos;t have an account?{" "}
									<button
										type="button"
										onClick={() => {
											setMode("signup");
											setError(null);
										}}
										className="font-medium hover:underline"
										style={{ color: "var(--color-brand)" }}
									>
										Sign up
									</button>
								</>
							) : (
								<>
									Already have an account?{" "}
									<button
										type="button"
										onClick={() => {
											setMode("signin");
											setError(null);
											setSignUpSuccess(false);
										}}
										className="font-medium hover:underline"
										style={{ color: "var(--color-brand)" }}
									>
										Sign in
									</button>
								</>
							)}
						</p>
					</>
				)}
			</div>
		</div>
	);
}

"use client";

import {
	Check,
	LoaderCircle,
	LogOut,
	RefreshCcw,
	Save,
	ShieldAlert,
	Unplug,
	User,
	Watch,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { type IntegrationStatus, useIntegrations } from "@/hooks/use-integrations";
import { useProfile } from "@/hooks/use-profile";

function providerLabel(provider: string): string {
	switch (provider.toUpperCase()) {
		case "STRAVA":
			return "Strava";
		case "GARMIN":
			return "Garmin";
		case "POLAR":
			return "Polar";
		case "WAHOO":
			return "Wahoo";
		default:
			return provider;
	}
}

function integrationSubtitle(integration: IntegrationStatus): string {
	if (!integration.available) {
		return integration.availabilityReason === "pending_approval"
			? "Pending provider approval"
			: "Not currently available";
	}

	if (!integration.connected) {
		return "Not connected";
	}

	if (!integration.lastSyncAt) {
		return "Connected, waiting for first sync";
	}

	const elapsedMs = Date.now() - new Date(integration.lastSyncAt).getTime();
	const elapsedHours = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60)));

	if (elapsedHours < 6) return "Synced recently";
	if (elapsedHours < 24) return `Sync stale (${elapsedHours}h ago)`;

	const elapsedDays = Math.max(1, Math.floor(elapsedHours / 24));
	return `Sync stale (${elapsedDays}d ago)`;
}

function statusTone(integration: IntegrationStatus): string {
	if (!integration.available) return "var(--color-warning)";
	if (integration.connected) return "var(--color-success)";
	return "var(--color-text-muted)";
}

export default function SettingsPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { profile, updateDefaultView, updateProfile } = useProfile();
	const {
		snapshot,
		isLoading,
		error,
		refetch,
		syncIntegration,
		disconnectIntegration,
		getConnectUrl,
	} = useIntegrations();

	const [displayName, setDisplayName] = useState<string | null>(null);
	const [timezone, setTimezone] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [busyProvider, setBusyProvider] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	const integrations = useMemo(
		() => [...snapshot.integrations].sort((a, b) => a.provider.localeCompare(b.provider)),
		[snapshot.integrations],
	);
	const callbackNotice = useMemo(() => {
		const provider = searchParams.get("integration");
		const status = searchParams.get("status");
		const callbackError = searchParams.get("error");

		if (!provider || (!status && !callbackError)) {
			return null;
		}

		const name = providerLabel(provider);
		if (status === "connected") {
			return {
				tone: "success" as const,
				message: `${name} connected successfully.`,
			};
		}

		if (callbackError === "denied") {
			return {
				tone: "error" as const,
				message: `${name} connection was cancelled or denied.`,
			};
		}

		return {
			tone: "error" as const,
			message: `${name} connection did not complete. Please try again.`,
		};
	}, [searchParams]);

	const handleSaveProfile = async () => {
		setIsSaving(true);
		setSaved(false);

		try {
			await updateProfile({
				displayName: displayName ?? profile.displayName,
				timezone: timezone ?? profile.timezone,
			});
			setSaved(true);
			setTimeout(() => {
				setSaved(false);
			}, 2000);
		} finally {
			setIsSaving(false);
		}
	};

	const handleConnect = async (integration: IntegrationStatus) => {
		setActionError(null);

		const connectUrl = getConnectUrl(integration);
		if (!connectUrl) {
			setActionError(`No connect URL available for ${providerLabel(integration.provider)}.`);
			return;
		}

		if (!integration.available) {
			window.open(connectUrl, "_blank", "noopener,noreferrer");
			return;
		}

		const url = new URL(connectUrl);
		url.searchParams.set("returnTo", `${window.location.origin}/workout/dashboard/settings`);
		window.location.assign(url.toString());
	};

	const handleSync = async (integration: IntegrationStatus) => {
		setBusyProvider(integration.provider);
		setActionError(null);

		try {
			await syncIntegration(integration);
		} catch (err) {
			setActionError(err instanceof Error ? err.message : "Failed to start sync.");
		} finally {
			setBusyProvider(null);
		}
	};

	const handleDisconnect = async (integration: IntegrationStatus) => {
		setBusyProvider(integration.provider);
		setActionError(null);

		try {
			await disconnectIntegration(integration);
		} catch (err) {
			setActionError(err instanceof Error ? err.message : "Failed to disconnect provider.");
		} finally {
			setBusyProvider(null);
		}
	};

	return (
		<div className="max-w-3xl space-y-8 animate-fade-in" data-testid="settings-page">
			<div>
				<h1 className="text-2xl font-bold">Settings</h1>
				<p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
					Profile, dashboard preferences, and device integrations
				</p>
			</div>

			{callbackNotice && (
				<div
					className="rounded-lg px-4 py-3 text-sm"
					style={{
						background:
							callbackNotice.tone === "success"
								? "oklch(0.40 0.12 145 / 0.15)"
								: "oklch(0.40 0.12 25 / 0.15)",
						color:
							callbackNotice.tone === "success" ? "oklch(0.70 0.15 145)" : "oklch(0.70 0.15 25)",
						border:
							callbackNotice.tone === "success"
								? "1px solid oklch(0.40 0.12 145 / 0.25)"
								: "1px solid oklch(0.40 0.12 25 / 0.25)",
					}}
				>
					{callbackNotice.message}
				</div>
			)}

			<div className="glass-card p-4 lg:p-6" data-testid="settings-profile-panel">
				<h3
					className="mb-4 flex items-center gap-2 text-sm font-semibold"
					style={{ color: "var(--color-text-secondary)" }}
				>
					<User size={16} /> Profile
				</h3>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label
							htmlFor="settings-display-name"
							className="mb-1.5 block text-xs font-medium"
							style={{ color: "var(--color-text-muted)" }}
						>
							Display Name
						</label>
						<input
							id="settings-display-name"
							type="text"
							defaultValue={profile.displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							className="glass-input w-full"
						/>
					</div>
					<div>
						<label
							htmlFor="settings-email"
							className="mb-1.5 block text-xs font-medium"
							style={{ color: "var(--color-text-muted)" }}
						>
							Email
						</label>
						<input
							id="settings-email"
							type="email"
							defaultValue={profile.email}
							className="glass-input w-full"
							disabled
							style={{ opacity: 0.5 }}
						/>
					</div>
					<div>
						<label
							htmlFor="settings-club"
							className="mb-1.5 block text-xs font-medium"
							style={{ color: "var(--color-text-muted)" }}
						>
							Club
						</label>
						<input
							id="settings-club"
							type="text"
							defaultValue={profile.clubName}
							className="glass-input w-full"
							disabled
							style={{ opacity: 0.5 }}
						/>
					</div>
					<div>
						<label
							htmlFor="settings-role"
							className="mb-1.5 block text-xs font-medium"
							style={{ color: "var(--color-text-muted)" }}
						>
							Role
						</label>
						<input
							id="settings-role"
							type="text"
							defaultValue={profile.role}
							className="glass-input w-full"
							disabled
							style={{ opacity: 0.5 }}
						/>
					</div>
					<div>
						<label
							htmlFor="settings-timezone"
							className="mb-1.5 block text-xs font-medium"
							style={{ color: "var(--color-text-muted)" }}
						>
							Timezone
						</label>
						<input
							id="settings-timezone"
							type="text"
							defaultValue={profile.timezone}
							onChange={(e) => setTimezone(e.target.value)}
							className="glass-input w-full"
						/>
					</div>
				</div>

				<button
					type="button"
					onClick={handleSaveProfile}
					disabled={isSaving}
					className="btn-primary mt-5 flex w-full items-center justify-center gap-2 text-sm disabled:opacity-50 sm:w-auto"
				>
					{saved ? <Check size={14} /> : <Save size={14} />}
					{isSaving ? "Saving..." : saved ? "Saved!" : "Save Profile"}
				</button>

				<div className="mt-6 border-t border-white/10 pt-4">
					<h4 className="mb-1 flex items-center gap-2 text-sm font-semibold">
						<RefreshCcw size={14} /> Onboarding
					</h4>
					<p className="mb-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
						Rerun setup to update your level, goals, and coaching context.
					</p>
					<button
						type="button"
						className="rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover-surface"
						onClick={() => router.push("/dashboard/onboarding?redo=1")}
					>
						Redo Onboarding
					</button>
				</div>
			</div>

			<div className="glass-card p-4 lg:p-6" data-testid="settings-dashboard-view-panel">
				<h3
					className="mb-4 flex items-center gap-2 text-sm font-semibold"
					style={{ color: "var(--color-text-secondary)" }}
				>
					<RefreshCcw size={16} /> Dashboard View
				</h3>
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={() => updateDefaultView("triathlon")}
						className={`flex-1 rounded-xl border p-3 text-left transition-all ${
							profile.defaultView === "triathlon"
								? "bg-primary/10 border-primary"
								: "border-transparent hover-surface"
						}`}
						style={{
							borderColor: profile.defaultView === "triathlon" ? "var(--color-brand)" : undefined,
						}}
					>
						<div className="mb-1 text-sm font-medium">Triathlon</div>
						<div className="text-xs text-muted">Swim, bike, and run focus</div>
					</button>
					<button
						type="button"
						onClick={() => updateDefaultView("strength")}
						className={`flex-1 rounded-xl border p-3 text-left transition-all ${
							profile.defaultView === "strength"
								? "bg-primary/10 border-primary"
								: "border-transparent hover-surface"
						}`}
						style={{
							borderColor: profile.defaultView === "strength" ? "var(--color-strength)" : undefined,
						}}
					>
						<div className="mb-1 text-sm font-medium">Strength</div>
						<div className="text-xs text-muted">Lifting and recovery focus</div>
					</button>
				</div>
			</div>

			<div className="glass-card p-4 lg:p-6" data-testid="settings-integrations-panel">
				<div className="mb-4 flex items-start justify-between gap-4">
					<div>
						<h3
							className="flex items-center gap-2 text-sm font-semibold"
							style={{ color: "var(--color-text-secondary)" }}
						>
							<Watch size={16} /> Integrations
						</h3>
						<p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
							Connect supported providers and trigger manual syncs from the same control plane used
							by mobile.
						</p>
					</div>
					<button
						type="button"
						onClick={() => void refetch()}
						className="rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover-surface"
					>
						Refresh
					</button>
				</div>

				{error && (
					<div
						className="mb-4 rounded-lg px-4 py-3 text-sm"
						style={{
							background: "oklch(0.40 0.12 25 / 0.15)",
							color: "oklch(0.70 0.15 25)",
							border: "1px solid oklch(0.40 0.12 25 / 0.25)",
						}}
					>
						{error}
					</div>
				)}

				{actionError && (
					<div
						className="mb-4 rounded-lg px-4 py-3 text-sm"
						style={{
							background: "oklch(0.40 0.12 25 / 0.15)",
							color: "oklch(0.70 0.15 25)",
							border: "1px solid oklch(0.40 0.12 25 / 0.25)",
						}}
					>
						{actionError}
					</div>
				)}

				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<LoaderCircle
							size={20}
							className="animate-spin"
							style={{ color: "var(--color-brand)" }}
						/>
					</div>
				) : (
					<div className="space-y-3">
						{integrations.map((integration) => {
							const isBusy = busyProvider === integration.provider;
							return (
								<div
									key={integration.provider}
									className="flex flex-col gap-3 rounded-xl border p-4"
									style={{ borderColor: "var(--color-glass-border)" }}
								>
									<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
										<div>
											<div className="flex items-center gap-2">
												<span className="text-sm font-medium">
													{providerLabel(integration.provider)}
												</span>
												<span
													className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
													style={{
														color: statusTone(integration),
														background: `color-mix(in oklch, ${statusTone(integration)}, transparent 85%)`,
													}}
												>
													{integration.available
														? integration.connected
															? "Connected"
															: "Not connected"
														: "Roadmap"}
												</span>
											</div>
											<p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
												{integrationSubtitle(integration)}
											</p>
										</div>

										<div className="flex flex-wrap gap-2">
											{!integration.connected ? (
												<button
													type="button"
													onClick={() => void handleConnect(integration)}
													className="rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover-surface"
												>
													{integration.available ? "Connect" : "View roadmap"}
												</button>
											) : (
												<>
													<button
														type="button"
														onClick={() => void handleSync(integration)}
														disabled={isBusy}
														className="rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover-surface disabled:opacity-50"
													>
														{isBusy ? "Working..." : "Sync now"}
													</button>
													<button
														type="button"
														onClick={() => void handleDisconnect(integration)}
														disabled={isBusy}
														className="rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover-surface disabled:opacity-50"
														style={{
															borderColor: "var(--color-danger)",
															color: "var(--color-danger)",
														}}
													>
														Disconnect
													</button>
												</>
											)}
										</div>
									</div>
								</div>
							);
						})}

						<div
							className="flex items-center justify-between rounded-xl border p-4"
							style={{ borderColor: "var(--color-glass-border)" }}
						>
							<div>
								<div className="text-sm font-medium">Webhook queue</div>
								<p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
									Pending background provider jobs
								</p>
							</div>
							<div className="text-sm font-semibold">{snapshot.webhookQueueSize}</div>
						</div>

						<div
							className="flex items-start gap-3 rounded-xl border p-4 text-xs"
							style={{
								borderColor: "var(--color-glass-border)",
								color: "var(--color-text-muted)",
							}}
						>
							<ShieldAlert size={16} className="mt-0.5 shrink-0" />
							<p>
								Garmin remains visible as roadmap-only until provider approval and OAuth 1.0a
								implementation are complete.
							</p>
						</div>
					</div>
				)}
			</div>

			<div className="glass-card p-4 lg:p-6">
				<h3
					className="mb-3 flex items-center gap-2 text-sm font-semibold"
					style={{ color: "var(--color-text-secondary)" }}
				>
					<LogOut size={16} /> Sign Out
				</h3>
				<form action="/workout/auth/signout" method="POST">
					<button
						type="submit"
						className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium transition-colors hover-surface"
					>
						<Unplug size={14} />
						Sign Out
					</button>
				</form>
			</div>
		</div>
	);
}

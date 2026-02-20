"use client";

import {
	Bell,
	Check,
	Heart,
	LayoutDashboard,
	LogOut,
	Save,
	Shield,
	Smartphone,
	User,
	Watch,
} from "lucide-react";
import { useState } from "react";
import { useProfile } from "@/hooks/use-profile";

const connectedDevices = [
	{
		name: "Garmin Fenix 8",
		icon: Watch,
		status: "Connected",
		color: "var(--color-success)",
	},
	{
		name: "FORM Smart Goggles",
		icon: Smartphone,
		status: "Connected",
		color: "var(--color-success)",
	},
	{
		name: "Wahoo KICKR",
		icon: Heart,
		status: "Pending",
		color: "var(--color-warning)",
	},
	{
		name: "Apple Health",
		icon: Shield,
		status: "Not connected",
		color: "var(--color-text-muted)",
	},
];

export default function SettingsPage() {
	const { profile, updateDefaultView, updateProfile } = useProfile();

	const [displayName, setDisplayName] = useState<string | null>(null);
	const [timezone, setTimezone] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	const [notifications, setNotifications] = useState({
		training: true,
		coach: true,
		relay: true,
		recovery: false,
	});

	const toggleNotification = (key: keyof typeof notifications) => {
		setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const handleSaveProfile = async () => {
		setIsSaving(true);
		setSaved(false);
		try {
			await updateProfile({
				displayName: displayName ?? profile.displayName,
				timezone: timezone ?? profile.timezone,
			});
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} catch {
			// Error logged inside hook
		} finally {
			setIsSaving(false);
		}
	};

	const notificationPrefs = [
		{
			key: "training" as const,
			label: "Training reminders",
			description: "Daily session notifications",
		},
		{
			key: "coach" as const,
			label: "AI Coach insights",
			description: "Weekly performance summaries",
		},
		{
			key: "relay" as const,
			label: "Relay baton passes",
			description: "When a teammate passes the baton",
		},
		{
			key: "recovery" as const,
			label: "Recovery alerts",
			description: "When readiness drops below threshold",
		},
	];

	return (
		<div className="space-y-8 animate-fade-in max-w-3xl">
			<div>
				<h1 className="text-2xl font-bold">Settings</h1>
				<p
					className="mt-1 text-sm"
					style={{ color: "var(--color-text-secondary)" }}
				>
					Profile, devices, and preferences
				</p>
			</div>

			{/* Profile */}
			<div className="glass-card p-4 lg:p-6">
				<h3
					className="text-sm font-semibold mb-4 flex items-center gap-2"
					style={{ color: "var(--color-text-secondary)" }}
				>
					<User size={16} /> Profile
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label
							className="text-xs font-medium block mb-1.5"
							style={{ color: "var(--color-text-muted)" }}
						>
							Display Name
						</label>
						<input
							type="text"
							defaultValue={profile.displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							className="glass-input w-full"
						/>
					</div>
					<div>
						<label
							className="text-xs font-medium block mb-1.5"
							style={{ color: "var(--color-text-muted)" }}
						>
							Email
						</label>
						<input
							type="email"
							defaultValue={profile.email}
							className="glass-input w-full"
							disabled
							style={{ opacity: 0.5 }}
						/>
					</div>
					<div>
						<label
							className="text-xs font-medium block mb-1.5"
							style={{ color: "var(--color-text-muted)" }}
						>
							Club
						</label>
						<input
							type="text"
							defaultValue={profile.clubName}
							className="glass-input w-full"
							disabled
							style={{ opacity: 0.5 }}
						/>
					</div>
					<div>
						<label
							className="text-xs font-medium block mb-1.5"
							style={{ color: "var(--color-text-muted)" }}
						>
							Role
						</label>
						<input
							type="text"
							defaultValue={profile.role}
							className="glass-input w-full"
							disabled
							style={{ opacity: 0.5 }}
						/>
					</div>
					<div>
						<label
							className="text-xs font-medium block mb-1.5"
							style={{ color: "var(--color-text-muted)" }}
						>
							Timezone
						</label>
						<input
							type="text"
							defaultValue={profile.timezone}
							onChange={(e) => setTimezone(e.target.value)}
							className="glass-input w-full"
						/>
					</div>
				</div>
				<button
					onClick={handleSaveProfile}
					disabled={isSaving}
					className="btn-primary mt-5 flex items-center justify-center gap-2 text-sm w-full sm:w-auto disabled:opacity-50"
				>
					{saved ? <Check size={14} /> : <Save size={14} />}
					{isSaving ? "Saving…" : saved ? "Saved!" : "Save Profile"}
				</button>
			</div>

			{/* Dashboard Preferences */}
			<div className="glass-card p-4 lg:p-6">
				<h3
					className="text-sm font-semibold mb-4 flex items-center gap-2"
					style={{ color: "var(--color-text-secondary)" }}
				>
					<LayoutDashboard size={16} /> Dashboard View
				</h3>
				<div className="flex items-center gap-4">
					<button
						onClick={() => updateDefaultView("triathlon")}
						className={`flex-1 p-3 rounded-xl border text-left transition-all ${
							profile.defaultView === "triathlon"
								? "bg-primary/10 border-primary"
								: "border-transparent hover-surface"
						}`}
						style={{
							borderColor:
								profile.defaultView === "triathlon"
									? "var(--color-brand)"
									: undefined,
						}}
					>
						<div className="font-medium text-sm mb-1">Triathlon</div>
						<div className="text-xs text-muted">Swim, Bike, Run focus</div>
					</button>
					<button
						onClick={() => updateDefaultView("strength")}
						className={`flex-1 p-3 rounded-xl border text-left transition-all ${
							profile.defaultView === "strength"
								? "bg-primary/10 border-primary"
								: "border-transparent hover-surface"
						}`}
						style={{
							borderColor:
								profile.defaultView === "strength"
									? "var(--color-strength)"
									: undefined,
						}}
					>
						<div className="font-medium text-sm mb-1">Strength</div>
						<div className="text-xs text-muted">Lifting & Recovery focus</div>
					</button>
				</div>
			</div>

			{/* Connected devices — static list, real integration in Phase 2 */}
			<div className="glass-card p-4 lg:p-6">
				<h3
					className="text-sm font-semibold mb-4 flex items-center gap-2"
					style={{ color: "var(--color-text-secondary)" }}
				>
					<Watch size={16} /> Connected Devices
				</h3>
				<div className="space-y-3">
					{connectedDevices.map((device) => (
						<div
							key={device.name}
							className="flex items-center justify-between p-3 rounded-xl hover-surface transition-colors"
						>
							<div className="flex items-center gap-3">
								<div
									className="w-9 h-9 rounded-lg flex items-center justify-center"
									style={{
										background: `color-mix(in oklch, ${device.color}, transparent 85%)`,
									}}
								>
									<device.icon size={16} style={{ color: device.color }} />
								</div>
								<span className="text-sm font-medium">{device.name}</span>
							</div>
							<span
								className="text-xs font-medium"
								style={{ color: device.color }}
							>
								{device.status}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Notifications — interactive toggles */}
			<div className="glass-card p-4 lg:p-6">
				<h3
					className="text-sm font-semibold mb-4 flex items-center gap-2"
					style={{ color: "var(--color-text-secondary)" }}
				>
					<Bell size={16} /> Notifications
				</h3>
				<div className="space-y-4">
					{notificationPrefs.map((pref) => (
						<button
							key={pref.key}
							onClick={() => toggleNotification(pref.key)}
							className="flex items-center justify-between cursor-pointer w-full text-left"
						>
							<div>
								<div className="text-sm font-medium">{pref.label}</div>
								<div
									className="text-xs"
									style={{ color: "var(--color-text-muted)" }}
								>
									{pref.description}
								</div>
							</div>
							<div
								className="w-12 h-7 rounded-full relative transition-colors shrink-0 ml-4"
								style={{
									background: notifications[pref.key]
										? "var(--color-brand)"
										: "var(--color-glass-bg-subtle)",
								}}
							>
								<div
									className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
										notifications[pref.key] ? "left-6" : "left-1"
									}`}
								/>
							</div>
						</button>
					))}
				</div>
			</div>

			{/* Danger zone */}
			<div
				className="glass-card p-4 lg:p-6"
				style={{ borderColor: "oklch(0.5 0.2 25 / 0.3)" }}
			>
				<h3
					className="text-sm font-semibold mb-4 flex items-center gap-2"
					style={{ color: "var(--color-danger)" }}
				>
					<LogOut size={16} /> Account
				</h3>
				<p
					className="text-xs mb-3"
					style={{ color: "var(--color-text-muted)" }}
				>
					Sign out of your account or manage subscription.
				</p>
				<form action="/workout/auth/signout" method="POST">
					<button
						type="submit"
						className="px-4 py-2 text-xs font-medium rounded-lg border transition-colors hover-surface"
						style={{
							borderColor: "var(--color-danger)",
							color: "var(--color-danger)",
						}}
					>
						Sign Out
					</button>
				</form>
			</div>
		</div>
	);
}

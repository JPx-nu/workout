import {
	Activity,
	Bike,
	Brain,
	Calendar,
	Footprints,
	RefreshCcw,
	Shield,
	Waves,
} from "lucide-react";
import Link from "next/link";

const features = [
	{
		icon: Brain,
		title: "AI Coach",
		description:
			"GraphRAG-powered coaching that understands your training history, injuries, and goals.",
		color: "var(--color-brand)",
	},
	{
		icon: Calendar,
		title: "Training Calendar",
		description:
			"Review planned workouts, update statuses, and keep your weekly schedule visible in one place.",
		color: "var(--color-success)",
	},
	{
		icon: Activity,
		title: "Workout History",
		description:
			"See recorded sessions, filter by discipline, and keep recent training context close to the coach.",
		color: "var(--color-warning)",
	},
	{
		icon: Waves,
		title: "2D Body Map",
		description:
			"Track fatigue and injury signals in the supported 2D recovery view backed by current athlete data.",
		color: "var(--color-swim)",
	},
	{
		icon: RefreshCcw,
		title: "Integrations Control",
		description:
			"Connect supported providers, refresh status, and trigger manual syncs from the settings control plane.",
		color: "var(--color-danger)",
	},
	{
		icon: Shield,
		title: "Secure Athlete Profile",
		description:
			"Your onboarding, preferences, and coaching context stay tied to your athlete profile and club claims.",
		color: "var(--color-strength)",
	},
];

const roadmap = [
	"Native HealthKit and Health Connect sync",
	"Garmin availability after provider approval",
	"Squads, relays, and team gamification",
	"Production-ready data export and deletion flows",
	"3D body map backed by live athlete data",
];

const disciplines = [
	{ icon: Waves, label: "Swim", color: "var(--color-swim)" },
	{ icon: Bike, label: "Bike", color: "var(--color-bike)" },
	{ icon: Footprints, label: "Run", color: "var(--color-run)" },
];

export default function LandingPage() {
	return (
		<div className="min-h-screen">
			<header className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center overflow-hidden">
				<div className="absolute inset-0 pointer-events-none overflow-hidden">
					<div
						className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl"
						style={{ background: "var(--color-swim)" }}
					/>
					<div
						className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl"
						style={{ background: "var(--color-brand)" }}
					/>
					<div
						className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full opacity-10 blur-3xl"
						style={{ background: "var(--color-run)" }}
					/>
				</div>

				<div className="relative z-10 animate-fade-in">
					<div className="flex items-center justify-center gap-3 mb-8">
						{disciplines.map(({ icon: Icon, label, color }) => (
							<span
								key={label}
								className="glass-card flex items-center gap-2 px-4 py-2 text-sm font-medium"
								style={{ color }}
							>
								<Icon size={16} />
								{label}
							</span>
						))}
					</div>

					<h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-6 leading-tight">
						Your AI-Powered
						<br />
						<span className="text-gradient">Athlete Cockpit</span>
					</h1>

					<p
						className="max-w-2xl mx-auto text-lg sm:text-xl mb-10 leading-relaxed"
						style={{ color: "var(--color-text-secondary)" }}
					>
						AI coaching, workouts, training planning, recovery tracking, and integration control for
						serious triathletes. Team gamification and native health sync remain on the roadmap.
					</p>

					<div className="flex items-center justify-center gap-4">
						<Link
							href="/login"
							className="btn-primary text-base px-8 py-3 inline-flex items-center gap-2"
						>
							<Brain size={18} />
							Launch Web Version
						</Link>
						<a
							href="#scope"
							className="btn-ghost text-base px-6 py-3 inline-flex items-center gap-2"
						>
							<Activity size={18} />
							See Current Scope
						</a>
					</div>
				</div>

				<div className="absolute bottom-8 animate-bounce opacity-40">
					<div
						className="w-6 h-10 rounded-full border-2 flex items-start justify-center p-1"
						style={{ borderColor: "var(--color-text-muted)" }}
					>
						<div
							className="w-1.5 h-3 rounded-full"
							style={{ background: "var(--color-text-muted)" }}
						/>
					</div>
				</div>
			</header>

			<section id="scope" className="max-w-6xl mx-auto px-6 py-24">
				<div className="text-center mb-16">
					<h2 className="text-3xl sm:text-4xl font-bold mb-4">Built for athlete self-serve</h2>
					<p style={{ color: "var(--color-text-secondary)" }} className="text-lg max-w-xl mx-auto">
						The current web version is intentionally focused on a reliable athlete cockpit before
						the proper native app expands the surface area.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
					{features.map(({ icon: Icon, title, description, color }) => (
						<div key={title} className="glass-card p-6">
							<div
								className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
								style={{
									background: `color-mix(in oklch, ${color}, transparent 80%)`,
								}}
							>
								<Icon size={20} style={{ color }} />
							</div>
							<h3 className="text-lg font-semibold mb-2">{title}</h3>
							<p
								className="text-sm leading-relaxed"
								style={{ color: "var(--color-text-secondary)" }}
							>
								{description}
							</p>
						</div>
					))}
				</div>
			</section>

			<section className="max-w-5xl mx-auto px-6 pb-24">
				<div className="glass-card p-8">
					<h2 className="text-2xl font-bold mb-3">Roadmap, not shipped</h2>
					<p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
						These items are intentionally outside the current web-v1 acceptance line.
					</p>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{roadmap.map((item) => (
							<div
								key={item}
								className="rounded-xl px-4 py-3 text-sm"
								style={{
									background: "var(--color-glass-bg-subtle)",
									color: "var(--color-text-secondary)",
									border: "1px solid var(--color-glass-border)",
								}}
							>
								{item}
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="max-w-4xl mx-auto px-6 py-24 text-center">
				<div className="glass-card p-12">
					<h2 className="text-3xl font-bold mb-4">Ready to train with more context?</h2>
					<p className="text-lg mb-8" style={{ color: "var(--color-text-secondary)" }}>
						Sign in to the current web cockpit for coaching, workouts, training, recovery, and real
						integration control.
					</p>
					<Link href="/login" className="btn-primary text-base px-8 py-3 inline-block">
						Get Started
					</Link>
				</div>
			</section>

			<footer
				className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm"
				style={{ color: "var(--color-text-muted)" }}
			>
				<span>© 2026 Triathlon AI by JPx</span>
				<span>Powered by Supabase + Next.js + LangGraph</span>
			</footer>
		</div>
	);
}

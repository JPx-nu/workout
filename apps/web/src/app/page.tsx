import {
	Activity,
	Bike,
	Brain,
	Footprints,
	Shield,
	Users,
	Waves,
	Zap,
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
		icon: Activity,
		title: "Smart Training Plans",
		description:
			"Auto-adaptive periodization based on real-time fatigue, HRV, and race countdown.",
		color: "var(--color-success)",
	},
	{
		icon: Zap,
		title: "Live Health Sync",
		description:
			"HealthKit & Health Connect integration for sleep, HRV, resting HR, and VO₂max.",
		color: "var(--color-warning)",
	},
	{
		icon: Users,
		title: "Virtual Relays",
		description:
			"Team gamification with baton passes, squad challenges, and real-time leaderboards.",
		color: "var(--color-swim)",
	},
	{
		icon: Shield,
		title: "Club-Grade Security",
		description:
			"Multi-tenant isolation with Custom Claims JWT and row-level security on every table.",
		color: "var(--color-danger)",
	},
	{
		icon: Waves,
		title: "3D Body Map",
		description:
			"Visualize muscle fatigue and injury risk with an interactive 3D heatmap.",
		color: "var(--color-strength)",
	},
];

const disciplines = [
	{ icon: Waves, label: "Swim", color: "var(--color-swim)" },
	{ icon: Bike, label: "Bike", color: "var(--color-bike)" },
	{ icon: Footprints, label: "Run", color: "var(--color-run)" },
];

export default function LandingPage() {
	return (
		<div className="min-h-screen">
			{/* Hero */}
			<header className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center overflow-hidden">
				{/* Animated glow orbs */}
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
					{/* Discipline pills */}
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
						<span className="text-gradient">Triathlon Coach</span>
					</h1>

					<p
						className="max-w-2xl mx-auto text-lg sm:text-xl mb-10 leading-relaxed"
						style={{ color: "var(--color-text-secondary)" }}
					>
						Intelligent training plans, real-time health insights, and team
						gamification — all powered by agentic AI that learns your body and
						your goals.
					</p>

					<div className="flex items-center justify-center gap-4">
						<Link
							href="/dashboard"
							className="btn-primary text-base px-8 py-3 inline-flex items-center gap-2"
						>
							<Zap size={18} />
							Enter Dashboard
						</Link>
						<Link
							href="/dashboard/coach"
							className="btn-ghost text-base px-6 py-3 inline-flex items-center gap-2"
						>
							<Brain size={18} />
							Try AI Coach
						</Link>
					</div>
				</div>

				{/* Scroll indicator */}
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

			{/* Features */}
			<section className="max-w-6xl mx-auto px-6 py-24">
				<div className="text-center mb-16">
					<h2 className="text-3xl sm:text-4xl font-bold mb-4">
						Built for serious athletes
					</h2>
					<p
						style={{ color: "var(--color-text-secondary)" }}
						className="text-lg max-w-xl mx-auto"
					>
						Every feature designed around the demands of swim-bike-run training.
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

			{/* CTA */}
			<section className="max-w-4xl mx-auto px-6 py-24 text-center">
				<div className="glass-card p-12">
					<h2 className="text-3xl font-bold mb-4">Ready to train smarter?</h2>
					<p
						className="text-lg mb-8"
						style={{ color: "var(--color-text-secondary)" }}
					>
						Join your club and let AI take your triathlon performance to the
						next level.
					</p>
					<Link
						href="/dashboard"
						className="btn-primary text-base px-8 py-3 inline-block"
					>
						Get Started — It&apos;s Free
					</Link>
				</div>
			</section>

			{/* Footer */}
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

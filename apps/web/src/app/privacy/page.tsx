import { Brain, Database, Lock, Shield, Watch } from "lucide-react";

function SectionHeading({
	icon: Icon,
	children,
}: {
	icon: typeof Brain;
	children: React.ReactNode;
}) {
	return (
		<h2
			className="mb-4 flex items-center gap-2 text-xl font-bold"
			style={{ color: "var(--color-text-primary)" }}
		>
			<Icon size={20} style={{ color: "var(--color-brand)" }} />
			{children}
		</h2>
	);
}

export default function PrivacyPolicyPage() {
	return (
		<div className="mx-auto max-w-4xl space-y-8 px-4 py-12 animate-fade-in">
			<div>
				<h1
					className="mb-2 text-4xl font-bold tracking-tight"
					style={{ color: "var(--color-text-primary)" }}
				>
					Privacy Policy
				</h1>
				<p style={{ color: "var(--color-text-secondary)" }}>Last Updated: March 11, 2026</p>
			</div>

			<div
				className="glass-card space-y-8 p-6 text-sm leading-relaxed lg:p-10"
				style={{ color: "var(--color-text-secondary)" }}
			>
				<section>
					<h2 className="mb-4 text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
						1. Scope
					</h2>
					<p>
						This page describes the current data handling for the shipped JPX product surface: the
						web app, the mobile companion app, the API, the AI Coach, and supported device
						integrations. It is intended to match the product as implemented today.
					</p>
				</section>

				<section>
					<SectionHeading icon={Database}>2. Data We Currently Collect</SectionHeading>
					<ul className="list-disc space-y-2 pl-5">
						<li>
							<strong>Account and profile data:</strong> name, email address, timezone, club
							affiliation, dashboard preference, and onboarding preferences.
						</li>
						<li>
							<strong>Training and recovery data:</strong> workouts, planned workouts, daily logs,
							injury records, and sync history used by the dashboard, body map, and coaching flows.
						</li>
						<li>
							<strong>Coach data:</strong> AI conversation history and any images you upload to the
							coach chat.
						</li>
						<li>
							<strong>Integration data:</strong> provider connection state, provider user IDs,
							encrypted OAuth tokens, webhook metadata, and sync results for supported providers.
						</li>
						<li>
							<strong>Mobile ingest data:</strong> workouts, metrics, and daily logs sent to
							`/api/health/ingest` when the mobile app sync flow is used.
						</li>
					</ul>
				</section>

				<section>
					<SectionHeading icon={Brain}>3. How We Use That Data</SectionHeading>
					<ul className="list-disc space-y-2 pl-5">
						<li>Authenticate you and load the correct athlete profile and club context.</li>
						<li>Show your dashboard, workouts, training calendar, body map, and settings state.</li>
						<li>
							Generate AI Coach responses, save conversation history, and extract coaching memories.
						</li>
						<li>
							Run provider syncs, webhook processing, and normalization into shared workout/health
							tables.
						</li>
						<li>
							Monitor service health, investigate failures, and protect the platform from abuse.
						</li>
					</ul>
				</section>

				<section>
					<SectionHeading icon={Watch}>
						4. Current Processors and Product Integrations
					</SectionHeading>
					<ul className="list-disc space-y-2 pl-5">
						<li>
							<strong>Microsoft Azure:</strong> current app hosting and related infrastructure.
						</li>
						<li>
							<strong>Supabase:</strong> authentication, PostgreSQL data storage, and coach image
							storage.
						</li>
						<li>
							<strong>Azure OpenAI:</strong> AI inference for the coach when AI features are
							enabled.
						</li>
						<li>
							<strong>Connected providers:</strong> Strava, Polar, and Wahoo when you explicitly
							start an integration flow. Garmin remains pending approval and is not an active
							end-user integration.
						</li>
					</ul>
					<p className="mt-4">
						The shipped product does not currently rely on Junction or other external aggregation
						layers for live consumer integrations.
					</p>
				</section>

				<section>
					<SectionHeading icon={Shield}>5. Current User Controls</SectionHeading>
					<ul className="list-disc space-y-2 pl-5">
						<li>Update display name, timezone, and dashboard preference from settings.</li>
						<li>Redo onboarding to refresh profile preferences and coaching context.</li>
						<li>Disconnect supported OAuth integrations from settings.</li>
					</ul>
					<p className="mt-4">
						Self-serve export and delete-account flows are not currently exposed in the shipped UI.
						If you need help with a privacy request, contact us directly.
					</p>
				</section>

				<section>
					<SectionHeading icon={Lock}>6. Contact</SectionHeading>
					<p>
						If you have questions about this page or need help with a privacy request, contact:
						<br />
						<br />
						<strong>Email:</strong> privacy@jpx.nu
						<br />
						<strong>Address:</strong> JPx AB, Gothenburg, Sweden
					</p>
				</section>
			</div>
		</div>
	);
}

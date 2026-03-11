import { AlertTriangle, FileText, HeartPulse, MonitorPlay, Scale } from "lucide-react";

function SectionHeading({
	icon: Icon,
	children,
}: {
	icon: typeof FileText;
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

export default function TermsOfServicePage() {
	return (
		<div className="mx-auto max-w-4xl space-y-8 px-4 py-12 animate-fade-in">
			<div>
				<h1
					className="mb-2 text-4xl font-bold tracking-tight"
					style={{ color: "var(--color-text-primary)" }}
				>
					Terms of Service
				</h1>
				<p style={{ color: "var(--color-text-secondary)" }}>Effective Date: March 11, 2026</p>
			</div>

			<div
				className="glass-card space-y-8 p-6 text-sm leading-relaxed lg:p-10"
				style={{ color: "var(--color-text-secondary)" }}
			>
				<section>
					<SectionHeading icon={FileText}>1. Acceptance of Terms</SectionHeading>
					<p>
						By accessing or using the JPX web app, mobile app, API, AI Coach, or connected
						integration flows, you agree to these Terms of Service. The service is provided by JPx
						AB in Gothenburg, Sweden.
					</p>
				</section>

				<section>
					<SectionHeading icon={MonitorPlay}>2. Current Service Scope</SectionHeading>
					<p>The shipped service currently includes:</p>
					<ul className="mt-2 list-disc space-y-2 pl-5">
						<li>web onboarding, dashboard, workouts, training calendar, body map, and settings</li>
						<li>AI Coach chat and conversation history</li>
						<li>planned workouts and integration status/control flows</li>
						<li>
							a mobile companion app with profile, training, coach, body map, and settings views
						</li>
					</ul>
					<p className="mt-4">
						Some features remain limited or experimental. For example, the 3D body map is still a
						sample-data preview, Garmin stays pending approval, and not every roadmap item is
						available in the shipped product.
					</p>
				</section>

				<section>
					<SectionHeading icon={HeartPulse}>3. Medical Disclaimer</SectionHeading>
					<div
						className="mb-4 rounded-xl border p-4"
						style={{
							borderColor: "var(--color-danger)",
							background: "color-mix(in oklch, var(--color-danger), transparent 90%)",
						}}
					>
						<p
							className="mb-2 text-xs font-medium uppercase tracking-wider"
							style={{ color: "var(--color-danger)" }}
						>
							Critical Notice
						</p>
						<p className="text-xs">
							JPx is not a medical device and does not provide medical advice. AI Coach responses,
							training suggestions, and recovery views are informational fitness tooling only.
						</p>
					</div>
					<p>
						You are responsible for using your own judgment and, when appropriate, consulting a
						qualified medical professional before acting on training or recovery guidance.
					</p>
				</section>

				<section>
					<SectionHeading icon={Scale}>4. Acceptable Use</SectionHeading>
					<p>You agree not to:</p>
					<ul className="mt-2 list-disc space-y-2 pl-5">
						<li>attempt to compromise the app, API, prompts, or safety controls</li>
						<li>upload or sync data you do not have the right to use</li>
						<li>abuse integrations, rate limits, or authentication flows</li>
						<li>use the service for unlawful or harmful activity</li>
					</ul>
				</section>

				<section>
					<SectionHeading icon={MonitorPlay}>5. Accounts and Integrations</SectionHeading>
					<p>
						You are responsible for your account credentials and for any third-party provider
						accounts you choose to connect. Provider availability can change, and some integrations
						may be limited, unavailable, or return pending-approval errors.
					</p>
				</section>

				<section>
					<SectionHeading icon={FileText}>6. Intellectual Property</SectionHeading>
					<p>
						The service, interface, branding, and software remain the property of JPx AB and its
						licensors. You retain rights to your own submitted data, but you grant us the rights
						needed to store, process, and display that data so the service can function.
					</p>
				</section>

				<section>
					<SectionHeading icon={AlertTriangle}>7. Availability and Liability</SectionHeading>
					<p>
						The service is provided on an "as is" and "as available" basis. To the maximum extent
						permitted by law, JPx AB is not liable for indirect, incidental, special, consequential,
						or exemplary damages arising from use of the service, reliance on AI-generated content,
						or temporary feature/integration unavailability.
					</p>
				</section>

				<section>
					<h2 className="mb-4 text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
						8. Governing Law
					</h2>
					<p>
						These terms are governed by the laws of Sweden. Any disputes arising from these terms
						shall be handled by the competent courts in Gothenburg, Sweden, unless applicable law
						requires otherwise.
					</p>
				</section>
			</div>
		</div>
	);
}

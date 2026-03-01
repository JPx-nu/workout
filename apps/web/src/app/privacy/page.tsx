import { Brain, Database, Lock, MapPin, Shield } from "lucide-react";

export default function PrivacyPolicyPage() {
	return (
		<div className="max-w-4xl mx-auto py-12 px-4 animate-fade-in space-y-8">
			<div>
				<h1 className="text-4xl font-bold tracking-tight mb-2">Privacy Policy</h1>
				<p style={{ color: "var(--color-text-secondary)" }}>Last Updated: February 21, 2026</p>
			</div>

			<div
				className="glass-card p-6 lg:p-10 space-y-8 text-sm leading-relaxed"
				style={{ color: "var(--color-text-secondary)" }}
			>
				<section>
					<h2 className="text-xl font-bold text-white mb-4">
						1. Introduction & Commitment to Privacy
					</h2>
					<p>
						At JPx (operated by JPx AB, Gothenburg, Sweden), we build elite triathlon and endurance
						training software. We believe your physiological data belongs to you. This Privacy
						Policy explains how we collect, use, and critically protect your personal and biometric
						information when you use the JPx AI Coach and platform.
					</p>
					<p className="mt-2">
						We are fully committed to the General Data Protection Regulation (GDPR), the upcoming
						European Health Data Space (EHDS) interoperability standards, and the EU AI Act
						classification for High-Risk AI systems.
					</p>
				</section>

				<section>
					<h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
						<Database className="text-brand" size={20} />
						2. Data We Collect
					</h2>
					<p>
						To provide personalized AI coaching and 3D movement analysis, we process the following
						categories of data with your explicit consent:
					</p>
					<ul className="list-disc pl-5 mt-2 space-y-2">
						<li>
							<strong>Identity & Profile Data:</strong> Name, email address, timezone, and club
							affiliation.
						</li>
						<li>
							<strong>Biometric & Health Telemetry:</strong> Heart Rate (HR), Heart Rate Variability
							(HRV), Sleep Stages, Resting Heart Rate (RHR), weight, and estimated VO2 Max.
						</li>
						<li>
							<strong>Training Data:</strong> GPS coordinates from activities, power output,
							cadence, perceived exertion (RPE), and injury logs.
						</li>
					</ul>
					<p className="mt-4 italic">
						* Note: We exclusively process fitness and wellness telemetry. JPx does not collect
						medical records or process data for medical diagnosis.
					</p>
				</section>

				<section>
					<h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
						<Brain className="text-brand" size={20} />
						3. How We Use the Data (The AI Coach)
					</h2>
					<p>
						Your data is primarily used to power the JPx AI Coach. The AI analyzes your readiness
						(e.g., HRV) to dynamically adjust your planned workouts, optimize recovery, and build
						structured training plans.
					</p>
					<div
						className="mt-4 p-4 rounded-xl border"
						style={{
							borderColor: "var(--color-glass-border)",
							background: "var(--color-glass-bg-subtle)",
						}}
					>
						<h3 className="font-bold text-white mb-2 text-xs uppercase tracking-wider">
							EU AI Act Guarantee (Human Oversight)
						</h3>
						<p className="text-xs">
							As a High-Risk AI system under the EU AI Act (2026), JPx provides full transparency
							when AI alters your schedule. While the AI generates suggestions, <strong>you</strong>{" "}
							retain the final say on execution. Our AI does <strong>not</strong> make binding
							medical or health decisions.
						</p>
					</div>
				</section>

				<section>
					<h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
						<MapPin className="text-brand" size={20} />
						4. Where Your Data Lives
					</h2>
					<p>
						Because data sovereignty matters,{" "}
						<strong>100% of JPx databases are hosted within the European Union (Sweden)</strong> via
						Microsoft Azure and Supabase. We do not transfer your raw biometric databases outside of
						the EU/EEA.
					</p>
				</section>

				<section>
					<h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
						<Shield className="text-brand" size={20} />
						5. Sub-Processors & Data Sharing
					</h2>
					<p>
						We do not. We never sell your data to third parties. We utilize a highly vetted list of
						enterprise sub-processors to deliver the service:
					</p>
					<ul className="list-disc pl-5 mt-2 space-y-2">
						<li>
							<strong>Microsoft Azure (EU):</strong> Primary cloud hosting and infrastructure.
						</li>
						<li>
							<strong>Supabase (EU):</strong> PostgreSQL database hosting with strict Row-Level
							Security preventing unauthorized access.
						</li>
						<li>
							<strong>Azure OpenAI (EU):</strong> Provides the LLM reasoning for the AI Coach. We
							operate under a strict <strong>Zero Data Retention</strong> agreement. Your prompts
							and biometric data are NEVER used to train foundational models and are discarded
							immediately after inference.
						</li>
						<li>
							<strong>Junction:</strong> Health API aggregation layer (routes Garmin/Oura data to
							our secure enclave).
						</li>
					</ul>
				</section>

				<section>
					<h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
						<Lock className="text-brand" size={20} />
						6. Your Rights (Data Control Center)
					</h2>
					<p>
						Under GDPR, you have the absolute right to control your data. Within the JPx App via the{" "}
						<strong>Data Control Center</strong> (Settings &gt; Privacy & Integrations), you can
						instantly:
					</p>
					<ul className="list-disc pl-5 mt-2 space-y-2">
						<li>
							<strong>Disconnect OAuth integrations</strong> to stop data flow.
						</li>
						<li>
							<strong>Export your data</strong> in a machine-readable JSON format (Right to
							Portability).
						</li>
						<li>
							<strong>Delete your account and all telemetry</strong> permanently (Right to be
							Forgotten). This triggers an immediate cascading database drop.
						</li>
					</ul>
				</section>

				<section>
					<h2 className="text-xl font-bold text-white mb-4">
						7. Contact the Data Protection Officer
					</h2>
					<p>
						If you have questions about this policy, or wish to exercise your rights manually,
						please contact our Data Protection Officer at:
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

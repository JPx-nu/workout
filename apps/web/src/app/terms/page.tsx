import { AlertTriangle, FileText, HeartPulse, MonitorPlay, Scale } from "lucide-react";

export default function TermsOfServicePage() {
	return (
		<div className="max-w-4xl mx-auto py-12 px-4 animate-fade-in space-y-8">
			<div>
				<h1 className="text-4xl font-bold tracking-tight mb-2">Terms of Service</h1>
				<p style={{ color: "var(--color-text-secondary)" }}>Effective Date: February 21, 2026</p>
			</div>

			<div
				className="glass-card p-6 lg:p-10 space-y-8 text-sm leading-relaxed"
				style={{ color: "var(--color-text-secondary)" }}
			>
				<section>
					<h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
						<FileText className="text-brand" size={20} />
						1. Acceptance of Terms
					</h2>
					<p>
						By accessing or using the JPx platform, AI Coach, 3D movement analysis, and associated
						APIs (collectively, the &quot;Service&quot;), you agree to be bound by these Terms of
						Service. The Service is provided by JPx AB (&quot;we&quot;, &quot;us&quot;, or
						&quot;our&quot;), headquartered in Gothenburg, Sweden. If you do not agree to all the
						terms and conditions, you may not use the Service.
					</p>
				</section>

				<section>
					<h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
						<HeartPulse className="text-error" style={{ color: "var(--color-error)" }} size={20} />
						2. Medical Disclaimer & AI Limitations
					</h2>
					<div
						className="p-4 rounded-xl border mb-4"
						style={{ borderColor: "var(--color-error)", background: "oklch(0.3 0.1 29 / 0.1)" }}
					>
						<p
							className="text-white font-medium mb-2 uppercase text-xs tracking-wider"
							style={{ color: "var(--color-error)" }}
						>
							Critical Notice
						</p>
						<p className="text-xs">
							<strong>JPx IS NOT A MEDICAL DEVICE AND DOES NOT PROVIDE MEDICAL ADVICE.</strong> The
							AI Coach, biometric analysis, and any generated training plans are for informational
							and recreational fitness purposes only. They are not intended to diagnose, treat,
							cure, or prevent any disease or medical condition.
						</p>
						<p className="text-xs mt-2">
							You should consult a physician before beginning any new training program, especially
							if you have a history of heart disease, joint injuries, or other pre-existing
							conditions. Always prioritize your perceived exertion and physical symptoms over
							AI-generated schedules.
						</p>
					</div>
					<p>
						The AI Coach utilizes advanced Large Language Models (LLMs) and heuristic algorithms. As
						an EU AI Act High-Risk System, you acknowledge and agree to maintain{" "}
						<strong>Human Oversight</strong> over all AI recommendations. You assume all risks
						associated with participating in endurance sports and utilizing the Service&apos;s
						recommendations.
					</p>
				</section>

				<section>
					<h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
						<MonitorPlay className="text-brand" size={20} />
						3. Acceptable Use
					</h2>
					<p>
						You agree to use the Service solely for your personal fitness and training coordination.
						You shall not:
					</p>
					<ul className="list-disc pl-5 mt-2 space-y-2">
						<li>
							Reverse engineer, decompile, or attempt to extract the source code or proprietary AI
							prompts of the Service.
						</li>
						<li>
							Input malicious code, prompt injection attacks, or attempts to compromise the AI
							safety guardrails.
						</li>
						<li>
							Upload data belonging to other individuals without their explicit, documented consent.
						</li>
						<li>
							Use the Service for commercial coaching purposes without an explicit Enterprise
							License Agreement.
						</li>
					</ul>
				</section>

				<section>
					<h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
						<Scale className="text-brand" size={20} />
						4. Intellectual Property
					</h2>
					<p>
						All intellectual property rights in the Service (including the interface, AI models
						fine-tuning, 3D rendering tech, algorithms, and branding) are the exclusive property of
						JPx AB.
					</p>
					<p className="mt-2">
						<strong>Your Data:</strong> You retain all rights to your personal telemetry, GPS data,
						and training logs. By using the Service, you grant us a temporary license to process
						this data exclusively to deliver the service to you and the AI Coach operations, as
						outlined in our Privacy Policy.
					</p>
				</section>

				<section>
					<h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
						<AlertTriangle className="text-brand" size={20} />
						5. Limitation of Liability
					</h2>
					<p>
						To the maximum extent permitted by applicable law, JPx AB shall not be liable for any
						direct, indirect, incidental, special, consequential, or exemplary damages, including
						but not limited to, damages for loss of profits, goodwill, use, data, physical injury,
						or other intangible losses resulting from your use or inability to use the Service or
						reliance on AI Coach suggestions.
					</p>
				</section>

				<section>
					<h2 className="text-xl font-bold text-white mb-4">6. Modification of Terms</h2>
					<p>
						We reserve the right to modify these Terms at any time. We will notify you of any
						material changes by posting the new Terms on the site and updating the &quot;Effective
						Date&quot; or via email. Your continuous use of the Service after such modifications
						signifies your acceptance of the updated Terms.
					</p>
				</section>

				<section>
					<h2 className="text-xl font-bold text-white mb-4">7. Governing Law</h2>
					<p>
						These Terms shall be governed by and construed in accordance with the laws of Sweden and
						the European Union, without regard to its conflict of law provisions. Any disputes
						arising out of these Terms shall be resolved exclusively in the competent courts of
						Gothenburg, Sweden.
					</p>
				</section>
			</div>
		</div>
	);
}

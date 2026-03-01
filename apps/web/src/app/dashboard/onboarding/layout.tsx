export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-dvh w-full flex items-center justify-center px-4 py-6 lg:px-8 lg:py-10">
			<div className="w-full max-w-3xl">{children}</div>
		</div>
	);
}

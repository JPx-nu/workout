export default function DashboardLoading() {
	return (
		<div className="flex h-[70vh] items-center justify-center">
			<div
				className="w-8 h-8 rounded-full border-2 animate-spin"
				style={{
					borderColor: "var(--color-glass-border)",
					borderTopColor: "var(--color-brand)",
				}}
			/>
		</div>
	);
}

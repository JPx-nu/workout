"use client";

import { Bot, Send, Sparkles, User } from "lucide-react";
import { useEffect } from "react";
import { useCoach } from "@/hooks/use-coach";

type CoachChatStepProps = {
	seedMessage: string;
	hasSeeded: boolean;
	onSeeded: () => void;
	onDone: () => void;
	onSkip: () => void;
	isSaving: boolean;
};

export function CoachChatStep({
	seedMessage,
	hasSeeded,
	onSeeded,
	onDone,
	onSkip,
	isSaving,
}: CoachChatStepProps) {
	const { messages, isTyping, input, setInput, sendMessage, error } = useCoach();

	useEffect(() => {
		if (hasSeeded || !seedMessage.trim()) return;
		onSeeded();
		void sendMessage(seedMessage);
	}, [hasSeeded, seedMessage, onSeeded, sendMessage]);

	return (
		<div className="glass-card p-6 lg:p-8 animate-fade-in">
			<div className="flex items-center gap-3 mb-3">
				<div
					className="w-10 h-10 rounded-xl flex items-center justify-center"
					style={{
						background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
					}}
				>
					<Bot size={18} />
				</div>
				<div>
					<h2 className="text-xl font-bold">Finish setup with your AI Coach</h2>
					<p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
						Share your schedule, constraints, and race plans. Or skip for now.
					</p>
				</div>
			</div>

			<div
				className="rounded-xl border p-3 space-y-3 overflow-y-auto"
				style={{ borderColor: "var(--color-glass-border)", maxHeight: "22rem" }}
			>
				{error && (
					<div
						className="rounded-lg px-3 py-2 text-xs"
						style={{
							background: "oklch(0.40 0.12 25 / 0.15)",
							color: "oklch(0.70 0.15 25)",
							border: "1px solid oklch(0.40 0.12 25 / 0.25)",
						}}
					>
						{error} You can still skip chat and finish onboarding.
					</div>
				)}

				{messages.length === 0 ? (
					<p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
						{error ? "Coach is unavailable right now." : "Starting your onboarding chat..."}
					</p>
				) : (
					messages.map((message) => (
						<div
							key={message.id}
							className={`flex gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}
						>
							<div
								className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
								style={{
									background:
										message.role === "assistant"
											? "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))"
											: "linear-gradient(135deg, var(--color-swim), oklch(0.5 0.15 220))",
								}}
							>
								{message.role === "assistant" ? <Bot size={12} /> : <User size={12} />}
							</div>
							<div
								className="rounded-xl px-3 py-2 text-sm max-w-[80%]"
								style={{
									background:
										message.role === "assistant"
											? "var(--color-glass-bg-subtle)"
											: "oklch(from var(--color-brand) l c h / 0.12)",
									border: "1px solid var(--color-glass-border)",
								}}
							>
								{message.content}
							</div>
						</div>
					))
				)}

				{isTyping && (
					<div
						className="text-xs flex items-center gap-1"
						style={{ color: "var(--color-text-muted)" }}
					>
						<Sparkles size={12} /> Coach is typing...
					</div>
				)}
			</div>

			<div className="mt-4 flex gap-2">
				<input
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							void sendMessage();
						}
					}}
					placeholder="Add details (availability, injuries, race date)..."
					className="glass-input flex-1"
				/>
				<button
					type="button"
					onClick={() => void sendMessage()}
					disabled={!input.trim()}
					className="btn-primary px-4 disabled:opacity-40 disabled:cursor-not-allowed"
					aria-label="Send message"
				>
					<Send size={16} />
				</button>
			</div>

			<div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
				<button type="button" className="btn-ghost text-sm" onClick={onSkip} disabled={isSaving}>
					Skip chat
				</button>
				<button
					type="button"
					onClick={onDone}
					disabled={isSaving}
					className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
				>
					{isSaving ? "Saving..." : "I'm done, go to dashboard"}
				</button>
			</div>
		</div>
	);
}

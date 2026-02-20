"use client";

import {
	Bot,
	ChevronLeft,
	ChevronRight,
	History,
	MessageSquare,
	Paperclip,
	Send,
	Sparkles,
	User,
	X,
} from "lucide-react";
import { useRef } from "react";
import { useCoach } from "@/hooks/use-coach";

export default function CoachPage() {
	const {
		messages,
		isTyping,
		input,
		setInput,
		sendMessage,
		suggestedPrompts,
		conversations,
		loadConversation,
		newConversation,
		conversationId,
		activeToolCalls,
		attachedFiles,
		attachFile,
		removeFile,
	} = useCoach();
	const promptsRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const scrollPrompts = (direction: "left" | "right") => {
		if (!promptsRef.current) return;
		const scrollAmount = 240;
		promptsRef.current.scrollBy({
			left: direction === "left" ? -scrollAmount : scrollAmount,
			behavior: "smooth",
		});
	};

	return (
		/* Break out of parent padding to use full width & height */
		<div className="flex gap-0 min-h-0 h-dvh animate-fade-in -mx-4 lg:-mx-8 -mt-4 lg:-mt-8 -mb-24 lg:-mb-8">
			{/* ═══ Main chat area ═══ */}
			<div className="flex-1 flex flex-col min-w-0 min-h-0 px-4 lg:px-8 pt-4 lg:pt-6 pb-20 lg:pb-5">
				{/* Header */}
				<div className="flex items-center gap-3 mb-4 shrink-0">
					<div
						className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse-glow"
						style={{
							background:
								"linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
						}}
					>
						<Bot size={20} />
					</div>
					<div>
						<h1 className="text-lg font-bold">AI Coach</h1>
						<p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
							Powered by GraphRAG + LangGraph
						</p>
					</div>
				</div>

				{/* Messages */}
				<div className="flex-1 overflow-y-auto space-y-5 pb-4 min-h-0 scrollbar-hide">
					<div className="max-w-4xl mx-auto w-full space-y-5">
						{messages.map((msg) => (
							<div
								key={msg.id}
								className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
							>
								<div
									className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
									style={{
										background:
											msg.role === "assistant"
												? "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))"
												: "linear-gradient(135deg, var(--color-swim), oklch(0.5 0.15 220))",
									}}
								>
									{msg.role === "assistant" ? (
										<Bot size={14} />
									) : (
										<User size={14} />
									)}
								</div>
								<div
									className={`glass-card p-3 lg:p-4 max-w-[85%] lg:max-w-[70%]`}
									style={
										msg.role === "user"
											? {
												background:
													"oklch(from var(--color-brand) l c h / 0.12)",
											}
											: undefined
									}
								>
									{/* Image thumbnails */}
									{msg.metadata?.imageUrls &&
										msg.metadata.imageUrls.length > 0 && (
											<div className="flex flex-wrap gap-2 mb-2">
												{msg.metadata.imageUrls.map((url, i) => (
													<img
														key={i}
														src={url}
														alt={`Attached image ${i + 1}`}
														className="rounded-lg object-cover cursor-pointer transition-transform hover:scale-105"
														style={{
															width:
																msg.metadata!.imageUrls!.length === 1
																	? "240px"
																	: "120px",
															height:
																msg.metadata!.imageUrls!.length === 1
																	? "180px"
																	: "90px",
															border: "1px solid var(--color-glass-border)",
														}}
														onClick={() => window.open(url, "_blank")}
													/>
												))}
											</div>
										)}
									<div className="text-sm leading-relaxed whitespace-pre-wrap">
										{msg.content}
									</div>
									{msg.metadata?.sources && (
										<div className="mt-2 flex flex-wrap gap-1">
											{msg.metadata.sources.map((src) => (
												<span
													key={src}
													className="text-[10px] px-1.5 py-0.5 rounded"
													style={{
														background: "var(--color-glass-bg-subtle)",
														color: "var(--color-text-muted)",
													}}
												>
													{src}
												</span>
											))}
										</div>
									)}
								</div>
							</div>
						))}

						{isTyping && (
							<div className="flex gap-3">
								<div
									className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
									style={{
										background:
											"linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
									}}
								>
									<Bot size={14} />
								</div>
								<div className="glass-card p-4">
									<div className="flex gap-1.5">
										<span
											className="w-2 h-2 rounded-full animate-bounce"
											style={{
												background: "var(--color-brand)",
												animationDelay: "0ms",
											}}
										/>
										<span
											className="w-2 h-2 rounded-full animate-bounce"
											style={{
												background: "var(--color-brand)",
												animationDelay: "150ms",
											}}
										/>
										<span
											className="w-2 h-2 rounded-full animate-bounce"
											style={{
												background: "var(--color-brand)",
												animationDelay: "300ms",
											}}
										/>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* ── Suggested prompts with arrow navigation ── */}
				<div className="flex items-center gap-1 shrink-0 py-2 max-w-4xl mx-auto w-full">
					<button
						type="button"
						onClick={() => scrollPrompts("left")}
						className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover-surface cursor-pointer"
						style={{
							color: "var(--color-text-muted)",
							border: "1px solid var(--color-glass-border)",
						}}
						aria-label="Scroll prompts left"
					>
						<ChevronLeft size={14} />
					</button>

					<div
						ref={promptsRef}
						className="flex-1 flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
					>
						{suggestedPrompts.map((prompt) => (
							<button
								key={prompt}
								onClick={() => setInput(prompt)}
								className="shrink-0 snap-start text-xs px-3 py-2 rounded-xl border transition-colors hover-surface cursor-pointer"
								style={{
									borderColor: "var(--color-glass-border)",
									color: "var(--color-text-secondary)",
								}}
							>
								<Sparkles
									size={10}
									className="inline mr-1"
									style={{ color: "var(--color-brand)" }}
								/>
								{prompt}
							</button>
						))}
					</div>

					<button
						type="button"
						onClick={() => scrollPrompts("right")}
						className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover-surface cursor-pointer"
						style={{
							color: "var(--color-text-muted)",
							border: "1px solid var(--color-glass-border)",
						}}
						aria-label="Scroll prompts right"
					>
						<ChevronRight size={14} />
					</button>
				</div>

				{/* Attached files preview strip */}
				{attachedFiles.length > 0 && (
					<div className="flex gap-2 pt-2 max-w-4xl mx-auto w-full shrink-0">
						{attachedFiles.map((file, i) => (
							<div key={i} className="relative group">
								<img
									src={URL.createObjectURL(file)}
									alt={file.name}
									className="w-16 h-16 rounded-lg object-cover"
									style={{ border: "2px solid var(--color-glass-border)" }}
								/>
								<button
									onClick={() => removeFile(i)}
									className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
									style={{
										background: "var(--color-error, #ef4444)",
										color: "white",
									}}
									aria-label={`Remove ${file.name}`}
								>
									<X size={10} />
								</button>
								<div
									className="absolute bottom-0 left-0 right-0 text-[8px] text-center truncate px-0.5 py-0.5 rounded-b-lg"
									style={{ background: "oklch(0 0 0 / 0.6)", color: "white" }}
								>
									{(file.size / 1024 / 1024).toFixed(1)}MB
								</div>
							</div>
						))}
					</div>
				)}

				{/* Input */}
				<div
					className="flex gap-3 pt-3 pb-1 shrink-0 border-t max-w-4xl mx-auto w-full"
					style={{ borderColor: "var(--color-glass-border)" }}
				>
					{/* Hidden file input */}
					<input
						ref={fileInputRef}
						type="file"
						accept="image/jpeg,image/png,image/webp,image/gif"
						multiple
						className="hidden"
						onChange={(e) => {
							const files = e.target.files;
							if (files) {
								Array.from(files).forEach((f) => attachFile(f));
							}
							e.target.value = ""; // Reset so same file can be re-selected
						}}
					/>
					{/* Attach button */}
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover-surface cursor-pointer"
						style={{
							color:
								attachedFiles.length > 0
									? "var(--color-brand)"
									: "var(--color-text-muted)",
							border: "1px solid var(--color-glass-border)",
						}}
						title="Attach image (workout schedule, equipment photo)"
						aria-label="Attach image"
					>
						<Paperclip size={16} />
						{attachedFiles.length > 0 && (
							<span
								className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
								style={{ background: "var(--color-brand)", color: "white" }}
							>
								{attachedFiles.length}
							</span>
						)}
					</button>
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && sendMessage()}
						placeholder={
							attachedFiles.length > 0
								? "Describe what you want to know about these images..."
								: "Ask your AI coach anything..."
						}
						className="glass-input flex-1"
					/>
					<button
						onClick={sendMessage}
						disabled={!input.trim() || isTyping}
						className="btn-primary px-4 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						<Send size={18} />
					</button>
				</div>
			</div>

			{/* ═══ Conversation history sidebar ═══ */}
			<div
				className="hidden xl:flex flex-col w-72 shrink-0 border-l"
				style={{ borderColor: "var(--color-glass-border)" }}
			>
				{/* Sidebar header */}
				<div
					className="px-5 py-4 shrink-0 border-b"
					style={{ borderColor: "var(--color-glass-border)" }}
				>
					<h3
						className="text-sm font-semibold flex items-center gap-2"
						style={{ color: "var(--color-text-primary)" }}
					>
						<History size={14} style={{ color: "var(--color-brand)" }} />
						Conversations
					</h3>
					<p
						className="text-[11px] mt-0.5"
						style={{ color: "var(--color-text-muted)" }}
					>
						{conversations.length} recent chats
					</p>
				</div>

				{/* Conversation list */}
				<div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-3 space-y-1">
					{conversations.map((conv) => {
						const isActive = conv.id === conversationId;
						return (
							<button
								key={conv.id}
								onClick={() => loadConversation(conv.id)}
								className={`w-full text-left p-3 rounded-xl text-xs transition-all cursor-pointer group
                                    ${isActive ? "" : "hover-surface"}`}
								style={
									isActive
										? {
											background: "oklch(0.65 0.18 170 / 0.1)",
											border: "1px solid oklch(0.65 0.18 170 / 0.2)",
										}
										: {
											border: "1px solid transparent",
										}
								}
							>
								<div className="flex items-start gap-2.5">
									<MessageSquare
										size={14}
										className="shrink-0 mt-0.5"
										style={{
											color: isActive
												? "var(--color-brand)"
												: "var(--color-text-muted)",
										}}
									/>
									<div className="min-w-0 flex-1">
										<div
											className="font-medium truncate"
											style={{
												color: isActive
													? "var(--color-brand-light)"
													: "var(--color-text-secondary)",
											}}
										>
											{conv.title || "Untitled"}
										</div>
										<div
											className="flex items-center gap-1.5 mt-1"
											style={{ color: "var(--color-text-muted)" }}
										>
											<span>{conv.message_count} msgs</span>
											<span>·</span>
											<span>
												{new Date(conv.updated_at).toLocaleDateString("en-US", {
													month: "short",
													day: "numeric",
												})}
											</span>
										</div>
									</div>
								</div>
							</button>
						);
					})}
				</div>

				{/* Sidebar footer */}
				<div
					className="px-4 py-3 shrink-0 border-t"
					style={{ borderColor: "var(--color-glass-border)" }}
				>
					<button
						onClick={newConversation}
						className="w-full text-xs py-2 rounded-lg transition-colors hover-surface cursor-pointer font-medium"
						style={{
							color: "var(--color-brand)",
							border: "1px solid var(--color-glass-border)",
						}}
					>
						+ New Conversation
					</button>
				</div>
			</div>
		</div>
	);
}

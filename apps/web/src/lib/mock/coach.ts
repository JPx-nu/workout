// ============================================================
// AI Coach Types & Constants
// ============================================================

export type Message = {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	createdAt: string;
	metadata?: {
		sources?: string[];
		confidence?: number;
		toolCalls?: string[];
		imageUrls?: string[];
	};
};

export type Conversation = {
	id: string;
	title: string;
	messages: Message[];
	createdAt: string;
};

export const suggestedPrompts = [
	"Why are my legs so tired?",
	"Create a taper plan for my race",
	"Analyze my swim technique trends",
	"What should I eat before a long ride?",
	"Compare my run pace this month vs last",
];

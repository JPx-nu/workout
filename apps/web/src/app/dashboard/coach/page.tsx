'use client';

import { Send, Bot, User, Sparkles, History } from 'lucide-react';
import { useCoach } from '@/hooks/use-coach';
import { mockConversationList } from '@/lib/mock';

export default function CoachPage() {
    // @mock — all data from useCoach hook
    const { messages, isTyping, input, setInput, sendMessage, suggestedPrompts } = useCoach();

    return (
        <div className="flex gap-6 h-[calc(100vh-7rem)] lg:h-[calc(100vh-5rem)] animate-fade-in">
            {/* Main chat area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse-glow"
                        style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))' }}>
                        <Bot size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold">AI Coach</h1>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Powered by GraphRAG + LangGraph
                        </p>
                    </div>
                </div>

                {/* Messages — @mock */}
                <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{
                                background: msg.role === 'assistant'
                                    ? 'linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))'
                                    : 'linear-gradient(135deg, var(--color-swim), oklch(0.5 0.15 220))',
                            }}>
                                {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                            </div>
                            <div className={`glass-card p-4 max-w-[80%] ${msg.role === 'user' ? '!bg-[oklch(0.2_0.04_220/0.4)]' : ''}`}>
                                <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                                {msg.metadata?.sources && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {msg.metadata.sources.map((src) => (
                                            <span key={src} className="text-[10px] px-1.5 py-0.5 rounded"
                                                style={{ background: 'oklch(0.2 0.01 260)', color: 'var(--color-text-muted)' }}>
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
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))' }}>
                                <Bot size={14} />
                            </div>
                            <div className="glass-card p-4">
                                <div className="flex gap-1.5">
                                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--color-brand)', animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--color-brand)', animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--color-brand)', animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Suggested prompts */}
                <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
                    {suggestedPrompts.map((prompt) => (
                        <button key={prompt}
                            onClick={() => setInput(prompt)}
                            className="shrink-0 text-xs px-3 py-2 rounded-xl border transition-colors hover:bg-white/5 cursor-pointer"
                            style={{
                                borderColor: 'var(--color-glass-border)',
                                color: 'var(--color-text-secondary)',
                            }}>
                            <Sparkles size={10} className="inline mr-1" style={{ color: 'var(--color-brand)' }} />
                            {prompt}
                        </button>
                    ))}
                </div>

                {/* Input */}
                <div className="flex gap-3 pt-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Ask your AI coach anything..."
                        className="glass-input flex-1"
                    />
                    <button onClick={sendMessage}
                        disabled={!input.trim() || isTyping}
                        className="btn-primary px-4 disabled:opacity-40 disabled:cursor-not-allowed">
                        <Send size={18} />
                    </button>
                </div>
            </div>

            {/* Conversation history sidebar — @mock */}
            <div className="hidden xl:block w-64 shrink-0">
                <div className="glass-card p-4 h-full overflow-y-auto">
                    <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"
                        style={{ color: 'var(--color-text-muted)' }}>
                        <History size={12} /> Conversations
                    </h3>
                    <div className="space-y-2">
                        {mockConversationList.map((conv, i) => (
                            <button key={conv.id}
                                className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors cursor-pointer
                        ${i === 0 ? '' : 'hover:bg-white/5'}`}
                                style={i === 0 ? {
                                    background: 'oklch(0.65 0.18 170 / 0.1)',
                                    color: 'var(--color-brand-light)',
                                } : { color: 'var(--color-text-secondary)' }}>
                                <div className="font-medium truncate">{conv.title}</div>
                                <div className="mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                    {conv.messageCount} messages · {new Date(conv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

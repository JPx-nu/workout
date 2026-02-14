'use client';

import { useRef } from 'react';
import { Send, Bot, User, Sparkles, History, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { useCoach } from '@/hooks/use-coach';
import { mockConversationList } from '@/lib/mock';

export default function CoachPage() {
    // @mock — all data from useCoach hook
    const { messages, isTyping, input, setInput, sendMessage, suggestedPrompts } = useCoach();
    const promptsRef = useRef<HTMLDivElement>(null);

    const scrollPrompts = (direction: 'left' | 'right') => {
        if (!promptsRef.current) return;
        const scrollAmount = 240;
        promptsRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth',
        });
    };

    return (
        /* Break out of parent padding to use full width & height */
        <div
            className="flex gap-0 min-h-0 h-dvh animate-fade-in -mx-4 lg:-mx-8 -mt-4 lg:-mt-8 -mb-24 lg:-mb-8"
        >
            {/* ═══ Main chat area ═══ */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 px-4 lg:px-8 pt-4 lg:pt-6 pb-20 lg:pb-5">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4 shrink-0">
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
                <div className="flex-1 overflow-y-auto space-y-5 pb-4 min-h-0 scrollbar-hide">
                    <div className="max-w-4xl mx-auto w-full space-y-5">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{
                                    background: msg.role === 'assistant'
                                        ? 'linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))'
                                        : 'linear-gradient(135deg, var(--color-swim), oklch(0.5 0.15 220))',
                                }}>
                                    {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                                </div>
                                <div className={`glass-card p-3 lg:p-4 max-w-[85%] lg:max-w-[70%]`}
                                    style={msg.role === 'user' ? { background: 'oklch(from var(--color-brand) l c h / 0.12)' } : undefined}>
                                    <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                                    {msg.metadata?.sources && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {msg.metadata.sources.map((src) => (
                                                <span key={src} className="text-[10px] px-1.5 py-0.5 rounded"
                                                    style={{ background: 'var(--color-glass-bg-subtle)', color: 'var(--color-text-muted)' }}>
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
                </div>

                {/* ── Suggested prompts with arrow navigation ── */}
                <div className="flex items-center gap-1 shrink-0 py-2 max-w-4xl mx-auto w-full">
                    <button
                        type="button"
                        onClick={() => scrollPrompts('left')}
                        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover-surface cursor-pointer"
                        style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-glass-border)' }}
                        aria-label="Scroll prompts left"
                    >
                        <ChevronLeft size={14} />
                    </button>

                    <div
                        ref={promptsRef}
                        className="flex-1 flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                    >
                        {suggestedPrompts.map((prompt) => (
                            <button key={prompt}
                                onClick={() => setInput(prompt)}
                                className="shrink-0 snap-start text-xs px-3 py-2 rounded-xl border transition-colors hover-surface cursor-pointer"
                                style={{
                                    borderColor: 'var(--color-glass-border)',
                                    color: 'var(--color-text-secondary)',
                                }}>
                                <Sparkles size={10} className="inline mr-1" style={{ color: 'var(--color-brand)' }} />
                                {prompt}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() => scrollPrompts('right')}
                        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover-surface cursor-pointer"
                        style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-glass-border)' }}
                        aria-label="Scroll prompts right"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>

                {/* Input */}
                <div className="flex gap-3 pt-3 pb-1 shrink-0 border-t max-w-4xl mx-auto w-full" style={{ borderColor: 'var(--color-glass-border)' }}>
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

            {/* ═══ Conversation history sidebar — @mock ═══ */}
            <div className="hidden xl:flex flex-col w-72 shrink-0 border-l" style={{ borderColor: 'var(--color-glass-border)' }}>
                {/* Sidebar header */}
                <div className="px-5 py-4 shrink-0 border-b" style={{ borderColor: 'var(--color-glass-border)' }}>
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                        <History size={14} style={{ color: 'var(--color-brand)' }} />
                        Conversations
                    </h3>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {mockConversationList.length} recent chats
                    </p>
                </div>

                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-3 space-y-1">
                    {mockConversationList.map((conv, i) => (
                        <button key={conv.id}
                            className={`w-full text-left p-3 rounded-xl text-xs transition-all cursor-pointer group
                                ${i === 0 ? '' : 'hover-surface'}`}
                            style={i === 0 ? {
                                background: 'oklch(0.65 0.18 170 / 0.1)',
                                border: '1px solid oklch(0.65 0.18 170 / 0.2)',
                            } : {
                                border: '1px solid transparent',
                            }}>
                            <div className="flex items-start gap-2.5">
                                <MessageSquare
                                    size={14}
                                    className="shrink-0 mt-0.5"
                                    style={{ color: i === 0 ? 'var(--color-brand)' : 'var(--color-text-muted)' }}
                                />
                                <div className="min-w-0 flex-1">
                                    <div
                                        className="font-medium truncate"
                                        style={{ color: i === 0 ? 'var(--color-brand-light)' : 'var(--color-text-secondary)' }}
                                    >
                                        {conv.title}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                        <span>{conv.messageCount} msgs</span>
                                        <span>·</span>
                                        <span>{new Date(conv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Sidebar footer */}
                <div className="px-4 py-3 shrink-0 border-t" style={{ borderColor: 'var(--color-glass-border)' }}>
                    <button
                        className="w-full text-xs py-2 rounded-lg transition-colors hover-surface cursor-pointer font-medium"
                        style={{ color: 'var(--color-brand)', border: '1px solid var(--color-glass-border)' }}
                    >
                        + New Conversation
                    </button>
                </div>
            </div>
        </div>
    );
}

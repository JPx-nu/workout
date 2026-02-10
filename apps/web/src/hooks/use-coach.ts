// ============================================================
// @mock — Service hook: useCoach
// STATUS: Using mock data
// SWAP TO: Supabase messages table + LangGraph streaming API
// ============================================================

import { useState, useCallback } from 'react';
import { mockConversation, suggestedPrompts, type Message } from '@/lib/mock';

/**
 * Returns AI coach conversation state and actions.
 *
 * @mock Currently returns hardcoded mock data + simulated typing.
 * @real Will use:
 *   - supabase.from('messages').select() for history
 *   - POST /api/ai/chat with streaming response for new messages
 *   - supabase.channel('messages').on('INSERT', ...) for realtime
 */
export function useCoach() {
    const [messages, setMessages] = useState<Message[]>(mockConversation.messages);
    const [isTyping, setIsTyping] = useState(false);
    const [input, setInput] = useState('');

    const sendMessage = useCallback(() => {
        const text = input.trim();
        if (!text || isTyping) return;

        // Add user message
        const userMsg: Message = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: text,
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');

        // @mock — simulate AI response with realistic delay
        setIsTyping(true);
        setTimeout(() => {
            const aiMsg: Message = {
                id: `msg-${Date.now() + 1}`,
                role: 'assistant',
                content: getMockResponse(text),
                createdAt: new Date().toISOString(),
                metadata: {
                    sources: ['workouts:recent', 'health_metrics:hrv'],
                    confidence: 0.85,
                    toolCalls: ['get_athlete_context'],
                },
            };
            setMessages((prev) => [...prev, aiMsg]);
            setIsTyping(false);
        }, 1500 + Math.random() * 1500);
    }, [input, isTyping]);

    return {
        messages,
        isTyping,
        input,
        setInput,
        sendMessage,
        suggestedPrompts,
        isLoading: false,
    };
}

// @mock — contextual mock responses
function getMockResponse(query: string): string {
    const lower = query.toLowerCase();

    if (lower.includes('tired') || lower.includes('fatigue') || lower.includes('heavy')) {
        return 'Based on your recent data, your training load has been elevated:\n\n• **Weekly TSS**: 685 (target 600)\n• **HRV**: Trending down 8% over 3 days\n• **Sleep**: Below average at 6.2h\n\nI recommend a recovery day tomorrow. Consider an easy swim or light yoga instead of the planned intervals. Your body needs deload to absorb the training adaptations.\n\n💡 *This insight came from your Garmin HRV data + sleep logs.*';
    }

    if (lower.includes('taper') || lower.includes('race')) {
        return '🏁 **Taper Plan for Ironman 70.3 Jönköping (June 14)**\n\nStarting 2 weeks out:\n\n**Week -2**: Reduce volume by 30%, maintain intensity\n- Swim: 5km total (down from 8km)\n- Bike: 140km total (down from 210km)\n- Run: 28km total (down from 42km)\n\n**Week -1 (Race Week)**: Reduce by 60%\n- Mon: Easy 30min swim\n- Tue: 45min bike with 3×5min race pace\n- Wed: 20min shakeout jog\n- Thu: Rest\n- Fri: 15min easy swim + visualization\n- Sat: Rest + race prep\n- Sun: 🏊🚴🏃 RACE DAY!\n\nWant me to save this to your training plan?';
    }

    if (lower.includes('swim') || lower.includes('technique')) {
        return '🏊 **Swim Analysis (Last 30 Days)**\n\n| Metric | Value | Trend |\n|---|---|---|\n| Avg Pace | 1:52/100m | ↓ 3% faster |\n| SWOLF | 42 | ↓ 2 points (good!) |\n| Distance/Week | 8.5km | → Stable |\n| Threshold | 1:45/100m | ↓ 4% improvement |\n\nYour catch phase has improved significantly based on FORM data. Focus areas:\n1. **Bilateral breathing** — you favor right side\n2. **Open water sighting** — practice every 3rd session\n3. **Drafting position** — useful for race day\n\n*Data source: FORM Smart Goggles*';
    }

    if (lower.includes('eat') || lower.includes('nutrition') || lower.includes('food')) {
        return '🍌 **Pre-Ride Nutrition Guide**\n\n**3 hours before** (if possible):\n- 600-800 calories\n- Oatmeal with banana, honey, and peanut butter\n- Coffee if tolerated\n\n**1 hour before**:\n- 200-300 calories\n- Energy bar or banana\n- Sip water (250-500ml)\n\n**During ride** (for rides >90min):\n- 60-90g carbs/hour\n- 500-750ml fluid/hour\n- Alternate between gels and solid food\n\nBased on your 74.5kg weight, you need ~48-67g carbs/hour minimum.\n\n⚠️ *Practice your race nutrition on long training rides!*';
    }

    return 'I\'m analyzing your recent training data and health metrics to provide a personalized recommendation.\n\nBased on what I can see:\n- Your training consistency is excellent (14 sessions this week)\n- HRV is slightly below baseline\n- Sleep quality could improve\n\nCould you be more specific about what you\'d like me to help with? I can assist with:\n\n1. 📊 Training load analysis\n2. 🧘 Recovery recommendations\n3. 📋 Plan adjustments\n4. 🏊 Technique feedback\n5. 🍎 Nutrition guidance\n\n*Powered by GraphRAG — combining your personal data with coaching knowledge.*';
}

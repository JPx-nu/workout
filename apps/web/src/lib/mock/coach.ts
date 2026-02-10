// ============================================================
// @mock — AI Coach conversation data
// TODO: Replace with Supabase query: supabase.from('messages').select()
// + real LangGraph streaming API
// See: docs/MOCK_DATA_MIGRATION.md
// ============================================================

export type Message = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
    metadata?: {
        sources?: string[];
        confidence?: number;
        toolCalls?: string[];
    };
};

export type Conversation = {
    id: string;
    title: string;
    messages: Message[];
    createdAt: string;
};

export const mockConversation: Conversation = {
    id: 'conv-001',
    title: 'Training recovery discussion',
    createdAt: '2026-02-10T07:30:00Z',
    messages: [
        {
            id: 'msg-001', role: 'assistant',
            createdAt: '2026-02-10T07:30:00Z',
            content: 'Good morning, Alex! 🌊 Based on your training data, your swim fitness has improved 12% this month. Your run TSS is trending high though — let\'s discuss recovery.',
            metadata: { sources: ['workouts:last_30d', 'health_metrics:hrv'], confidence: 0.92 },
        },
        {
            id: 'msg-002', role: 'user',
            createdAt: '2026-02-10T07:31:00Z',
            content: 'My legs feel heavy after yesterday\'s long run. Should I still do intervals tomorrow?',
        },
        {
            id: 'msg-003', role: 'assistant',
            createdAt: '2026-02-10T07:31:30Z',
            content: 'Great question. Looking at your data:\n\n• **HRV trend**: Down 8% over 3 days (62ms → 57ms)\n• **Sleep**: Only 6.2h last night vs your 7.5h average\n• **Cumulative TSS**: 685 this week (above your 600 target)\n\n**My recommendation**: Swap tomorrow\'s intervals for an **easy 40min spin** on the bike. Your body needs a deload day. Save the hard running for Thursday when your HRV should recover.\n\nWant me to adjust your training plan?',
            metadata: {
                sources: ['health_metrics:hrv', 'daily_logs:sleep', 'workouts:weekly_tss'],
                confidence: 0.88,
                toolCalls: ['get_hrv_trend', 'get_sleep_data', 'calculate_weekly_tss'],
            },
        },
        {
            id: 'msg-004', role: 'user',
            createdAt: '2026-02-10T07:32:00Z',
            content: 'Yes, please adjust it. Also, what should I focus on in the pool today?',
        },
        {
            id: 'msg-005', role: 'assistant',
            createdAt: '2026-02-10T07:32:30Z',
            content: 'Done! I\'ve moved the run intervals to Thursday and added a recovery spin for tomorrow.\n\nFor today\'s swim, since your upper body is fresh:\n\n🏊 **Suggested Session** (50min):\n1. 400m easy warm-up with catch-up drill\n2. 6×150m @ threshold pace (1:55/100m), 20s rest\n3. 4×50m sprint (max effort), 30s rest\n4. 300m easy cool-down with backstroke\n\nThis targets your race-pace endurance while keeping volume moderate. Sound good?',
            metadata: {
                sources: ['training_plans:current', 'document_chunks:swim_methodology'],
                confidence: 0.91,
                toolCalls: ['update_training_plan', 'get_swim_zones', 'match_documents'],
            },
        },
    ],
};

export const mockConversationList: Array<{ id: string; title: string; createdAt: string; messageCount: number }> = [
    { id: 'conv-001', title: 'Training recovery discussion', createdAt: '2026-02-10T07:30:00Z', messageCount: 5 },
    { id: 'conv-002', title: 'Race nutrition strategy', createdAt: '2026-02-08T19:00:00Z', messageCount: 8 },
    { id: 'conv-003', title: 'Swim technique analysis', createdAt: '2026-02-05T06:45:00Z', messageCount: 12 },
    { id: 'conv-004', title: 'Bike FTP test results', createdAt: '2026-02-02T17:30:00Z', messageCount: 6 },
];

export const suggestedPrompts = [
    'Why are my legs so tired?',
    'Create a taper plan for my race',
    'Analyze my swim technique trends',
    'What should I eat before a long ride?',
    'Compare my run pace this month vs last',
];

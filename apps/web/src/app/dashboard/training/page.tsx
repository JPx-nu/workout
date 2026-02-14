'use client';

import { Calendar, Trophy, CheckCircle2, Circle, Waves, Bike, Footprints, Dumbbell } from 'lucide-react';
import { useTraining } from '@/hooks/use-training';

const typeIcons: Record<string, typeof Waves> = {
    SWIM: Waves, BIKE: Bike, RUN: Footprints, STRENGTH: Dumbbell,
};

const typeColors: Record<string, string> = {
    SWIM: 'var(--color-swim)', BIKE: 'var(--color-bike)',
    RUN: 'var(--color-run)', STRENGTH: 'var(--color-strength)',
};

export default function TrainingPage() {
    // @mock — all data from useTraining hook
    const { plan, events, daysUntilEvent, completedCount, totalSessions, progressPercent, toggleSession } = useTraining();

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold">Training Plan</h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {plan.name}
                </p>
            </div>

            {/* Plan overview cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card p-4 lg:p-5 text-center">
                    <Trophy size={20} style={{ color: 'var(--color-warning)' }} className="mx-auto mb-2" />
                    <div className="text-2xl font-bold">{daysUntilEvent}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Days to race</div>
                    <div className="text-xs font-medium mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {plan.eventName}
                    </div>
                </div>

                <div className="glass-card p-4 lg:p-5 text-center">
                    <Calendar size={20} style={{ color: 'var(--color-brand)' }} className="mx-auto mb-2" />
                    <div className="text-2xl font-bold">Week {plan.currentWeek}<span className="text-base font-normal" style={{ color: 'var(--color-text-muted)' }}>/{plan.totalWeeks}</span></div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Plan progress</div>
                    <div className="progress-bar mt-3">
                        <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                    </div>
                </div>

                <div className="glass-card p-4 lg:p-5 text-center">
                    <CheckCircle2 size={20} style={{ color: 'var(--color-success)' }} className="mx-auto mb-2" />
                    <div className="text-2xl font-bold">{completedCount}<span className="text-base font-normal" style={{ color: 'var(--color-text-muted)' }}>/{totalSessions}</span></div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Sessions this week</div>
                </div>
            </div>

            {/* This week's sessions — @mock, clickable to toggle */}
            <div className="glass-card p-4 lg:p-6">
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                    This Week&apos;s Sessions
                </h3>
                <div className="space-y-3">
                    {plan.thisWeek.map((session, i) => {
                        const Icon = typeIcons[session.type] ?? Dumbbell;
                        const color = typeColors[session.type];
                        return (
                            <button key={i} onClick={() => toggleSession(i)}
                                className={`w-full flex items-center gap-4 p-3 rounded-xl transition-colors text-left
                        ${session.done ? 'opacity-60' : 'hover-surface'}`}>
                                {session.done ? (
                                    <CheckCircle2 size={20} style={{ color: 'var(--color-success)' }} className="shrink-0" />
                                ) : (
                                    <Circle size={20} style={{ color: 'var(--color-text-muted)' }} className="shrink-0" />
                                )}
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ background: `color-mix(in oklch, ${color}, transparent 80%)` }}>
                                    <Icon size={16} style={{ color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium ${session.done ? 'line-through' : ''}`}>
                                        {session.session}
                                    </div>
                                    {session.durationMin && (
                                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{session.durationMin} min</div>
                                    )}
                                </div>
                                <span className="text-xs font-medium shrink-0 px-2 py-1 rounded-lg"
                                    style={{
                                        color: 'var(--color-text-muted)',
                                        background: 'var(--color-glass-bg-subtle)',
                                    }}>
                                    {session.day}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Upcoming events — @mock */}
            {events.length > 0 && (
                <div className="glass-card p-4 lg:p-6">
                    <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                        Race Calendar
                    </h3>
                    <div className="space-y-3">
                        {events.map((event) => (
                            <div key={event.id} className="flex items-center justify-between p-3 rounded-xl hover-surface transition-colors">
                                <div>
                                    <div className="text-sm font-medium">{event.name}</div>
                                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        {' · '}{event.location}
                                    </div>
                                </div>
                                <span className="badge" style={{
                                    background: 'oklch(0.65 0.18 170 / 0.15)',
                                    color: 'var(--color-brand-light)',
                                }}>
                                    {event.daysUntil} days
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { MuscleFatigue } from '@/lib/mock/health';

/* ─── Recovery recommendation based on fatigue level ─── */
function getRecovery(level: number): { text: string; time: string; tip: string } {
    if (level >= 80) return {
        text: 'Critical fatigue — prioritize rest',
        time: '48–72 hours',
        tip: 'Foam rolling, light stretching, cold therapy recommended',
    };
    if (level >= 60) return {
        text: 'Elevated fatigue — limit intensity',
        time: '24–48 hours',
        tip: 'Active recovery: easy swim or walk, dynamic stretching',
    };
    if (level >= 40) return {
        text: 'Moderate — manageable with proper warm-up',
        time: '12–24 hours',
        tip: 'Can train but avoid heavy eccentric loads',
    };
    return {
        text: 'Fresh — ready for high intensity',
        time: 'Ready now',
        tip: 'Muscle is well-recovered; safe for interval work',
    };
}

function statusBadge(status: string): { label: string; color: string; bg: string } {
    switch (status) {
        case 'high': return { label: 'HIGH', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
        case 'moderate': return { label: 'MODERATE', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
        default: return { label: 'LOW', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' };
    }
}

/* ─── Muscle groups overview (collapsible) ─── */
function MuscleList({ fatigueData }: { fatigueData: MuscleFatigue[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const sorted = [...fatigueData].sort((a, b) => b.level - a.level);

    return (
        <div>
            {/* Clickable header */}
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center justify-between py-2 group cursor-pointer"
            >
                <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    All Muscle Groups
                </h4>
                <div className="flex items-center gap-2">
                    <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                        {fatigueData.length}
                    </span>
                    <ChevronDown
                        size={14}
                        className="transition-transform duration-200"
                        style={{
                            color: 'var(--color-text-muted)',
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                    />
                </div>
            </button>

            {/* Collapsible list */}
            <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                    maxHeight: isOpen ? `${sorted.length * 52 + 8}px` : '0px',
                    opacity: isOpen ? 1 : 0,
                }}
            >
                <div className="space-y-2 pt-1">
                    {sorted.map(f => {
                        const badge = statusBadge(f.status);
                        return (
                            <div
                                key={f.bodyPart}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all"
                                style={{ background: 'var(--color-glass-bg)' }}
                            >
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                        {f.muscle}
                                    </span>
                                </div>
                                <div className="w-20 h-1.5 rounded-full" style={{ background: 'var(--color-progress-track, rgba(255,255,255,0.1))' }}>
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${f.level}%`, background: badge.color }}
                                    />
                                </div>
                                <span className="text-xs font-bold w-8 text-right" style={{ color: badge.color }}>
                                    {f.level}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   MAIN DETAIL COMPONENT
   ═══════════════════════════════════════════════════ */
export default function MuscleDetail({
    muscleName,
    fatigue,
    fatigueData,
    side,
}: {
    muscleName: string | null;
    fatigue: MuscleFatigue | null;
    fatigueData: MuscleFatigue[];
    side: 'front' | 'back';
}) {
    if (!muscleName || !fatigue) {
        return (
            <div className="glass-card p-5 space-y-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="text-center py-4">
                    <div className="text-3xl mb-3">🏃</div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        Tap a muscle group
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Click any zone on the body to see details
                    </p>
                </div>
                <MuscleList fatigueData={fatigueData} />
            </div>
        );
    }

    const level = fatigue.level;
    const badge = statusBadge(fatigue.status);
    const recovery = getRecovery(level);

    return (
        <div className="glass-card p-5 space-y-5" style={{ borderColor: badge.color + '40' }}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {muscleName}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {side === 'front' ? 'Anterior' : 'Posterior'} view
                    </p>
                </div>
                <span
                    className="px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{ color: badge.color, background: badge.bg }}
                >
                    {badge.label}
                </span>
            </div>

            {/* Fatigue ring */}
            <div className="flex items-center gap-5">
                <div className="relative w-20 h-20 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="14" fill="none"
                            stroke="var(--color-progress-track, rgba(255,255,255,0.1))" strokeWidth="3" />
                        <circle cx="18" cy="18" r="14" fill="none"
                            stroke={badge.color} strokeWidth="3"
                            strokeDasharray={`${(level / 100) * 88} 88`}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dasharray 0.5s ease' }} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-bold"
                        style={{ color: badge.color }}>
                        {level}%
                    </span>
                </div>
                <div className="flex-1 space-y-1.5">
                    <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Fatigue Level</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{recovery.text}</div>
                </div>
            </div>

            {/* Recovery info */}
            <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--color-glass-bg)' }}>
                    <span className="text-lg">⏱️</span>
                    <div>
                        <div className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>Est. Recovery</div>
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{recovery.time}</div>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--color-glass-bg)' }}>
                    <span className="text-lg">💡</span>
                    <div>
                        <div className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>Recommendation</div>
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{recovery.tip}</div>
                    </div>
                </div>
            </div>

            <hr style={{ borderColor: 'var(--color-border)' }} />
            <MuscleList fatigueData={fatigueData} />
        </div>
    );
}

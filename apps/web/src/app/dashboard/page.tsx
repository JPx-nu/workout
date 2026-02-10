'use client';

import { Waves, Bike, Footprints, Dumbbell, TrendingUp, Heart, Calendar, ChevronRight } from 'lucide-react';
import { useWorkouts, formatDuration, mToKm } from '@/hooks/use-workouts';
import { useTraining } from '@/hooks/use-training';
import { useHealth } from '@/hooks/use-health';
import { useProfile } from '@/hooks/use-profile';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const activityIcons: Record<string, typeof Waves> = {
    SWIM: Waves, BIKE: Bike, RUN: Footprints, STRENGTH: Dumbbell,
};

const activityColors: Record<string, string> = {
    SWIM: 'var(--color-swim)', BIKE: 'var(--color-bike)',
    RUN: 'var(--color-run)', STRENGTH: 'var(--color-strength)',
};

function ReadinessGauge({ score }: { score: number }) {
    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="relative w-36 h-36">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none"
                    stroke="oklch(0.2 0.01 260)" strokeWidth="8" />
                <circle cx="60" cy="60" r="54" fill="none"
                    stroke="url(#readinessGradient)" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-1000 ease-out" />
                <defs>
                    <linearGradient id="readinessGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="oklch(0.65 0.18 170)" />
                        <stop offset="100%" stopColor="oklch(0.65 0.15 220)" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{score}</span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Readiness</span>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const { profile } = useProfile();           // @mock
    const { weeklyStats, chartData, allWorkouts } = useWorkouts(); // @mock
    const { events } = useTraining();             // @mock
    const { healthSnapshot } = useHealth();       // @mock

    const firstName = profile.displayName.split(' ')[0];

    const statCards = [
        {
            label: 'Swim', icon: Waves, color: activityColors.SWIM, badgeClass: 'badge-swim',
            value: `${weeklyStats.swim.distanceKm} km`, sub: `${weeklyStats.swim.sessions} sessions`,
        },
        {
            label: 'Bike', icon: Bike, color: activityColors.BIKE, badgeClass: 'badge-bike',
            value: `${weeklyStats.bike.distanceKm} km`, sub: `${weeklyStats.bike.sessions} sessions`,
        },
        {
            label: 'Run', icon: Footprints, color: activityColors.RUN, badgeClass: 'badge-run',
            value: `${weeklyStats.run.distanceKm} km`, sub: `${weeklyStats.run.sessions} sessions`,
        },
        {
            label: 'Strength', icon: Dumbbell, color: activityColors.STRENGTH, badgeClass: 'badge-strength',
            value: `${weeklyStats.strength.durationMin} min`, sub: `${weeklyStats.strength.sessions} sessions`,
        },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Good morning, {firstName} 👋</h1>
                <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Week 6 of your Ironman 70.3 build. {weeklyStats.totalTSS} TSS this week.
                </p>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
                {statCards.map(({ label, icon: Icon, badgeClass, value, sub }) => (
                    <div key={label} className="glass-card p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className={`badge ${badgeClass}`}>
                                <Icon size={12} /> {label}
                            </span>
                        </div>
                        <div className="text-2xl font-bold">{value}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{sub}</div>
                    </div>
                ))}
            </div>

            {/* Middle row: Chart + Readiness */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Activity chart */}
                <div className="glass-card p-6 lg:col-span-2">
                    <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                        Training Volume (min/day)
                    </h3>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barGap={2}>
                                <XAxis dataKey="day" tick={{ fill: 'oklch(0.5 0.01 260)', fontSize: 12 }}
                                    axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: 'oklch(0.5 0.01 260)', fontSize: 12 }}
                                    axisLine={false} tickLine={false} width={30} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'oklch(0.14 0.01 260 / 0.9)',
                                        border: '1px solid oklch(0.95 0.005 260 / 0.1)',
                                        borderRadius: '0.75rem',
                                        color: 'white',
                                        backdropFilter: 'blur(12px)',
                                    }}
                                />
                                <Bar dataKey="swim" stackId="a" fill="oklch(0.65 0.15 220)" />
                                <Bar dataKey="bike" stackId="a" fill="oklch(0.65 0.15 45)" />
                                <Bar dataKey="run" stackId="a" fill="oklch(0.65 0.15 25)" />
                                <Bar dataKey="strength" stackId="a" fill="oklch(0.65 0.12 310)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Readiness + Upcoming */}
                <div className="space-y-6">
                    <div className="glass-card p-6 flex flex-col items-center">
                        <ReadinessGauge score={healthSnapshot.readinessScore} />
                        <div className="flex items-center gap-2 mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            <Heart size={14} style={{ color: 'var(--color-danger)' }} />
                            HRV: {healthSnapshot.hrv}ms • Sleep: {healthSnapshot.sleepHours}h
                        </div>
                    </div>

                    <div className="glass-card p-5">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"
                            style={{ color: 'var(--color-text-secondary)' }}>
                            <Calendar size={14} /> Upcoming Events
                        </h3>
                        <div className="space-y-3">
                            {events.map((event) => (
                                <div key={event.id} className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium">{event.name}</div>
                                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{event.date}</div>
                                    </div>
                                    <span className="badge" style={{
                                        background: 'oklch(0.65 0.18 170 / 0.15)',
                                        color: 'var(--color-brand-light)',
                                    }}>
                                        {event.daysUntil}d
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent workouts — @mock */}
            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                        Recent Workouts
                    </h3>
                    <a href="/dashboard/workouts" className="text-xs font-medium flex items-center gap-1"
                        style={{ color: 'var(--color-brand-light)' }}>
                        View all <ChevronRight size={14} />
                    </a>
                </div>
                <div className="space-y-3">
                    {allWorkouts.slice(0, 4).map((w) => {
                        const Icon = activityIcons[w.activityType] ?? Dumbbell;
                        const color = activityColors[w.activityType] ?? 'var(--color-text-muted)';
                        return (
                            <div key={w.id} className="flex items-center gap-4 p-3 rounded-xl transition-colors hover:bg-white/[0.03]">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ background: `color-mix(in oklch, ${color}, transparent 80%)` }}>
                                    <Icon size={16} style={{ color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium">{w.notes}</div>
                                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {new Date(w.startedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        {' · '}{w.source}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-sm font-medium">{formatDuration(w.durationSec)}</div>
                                    {w.distanceM && (
                                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{mToKm(w.distanceM)}km</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

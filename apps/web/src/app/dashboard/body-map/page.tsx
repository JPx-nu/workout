'use client';

import Link from 'next/link';
import { Activity, Heart, Moon, Zap } from 'lucide-react';
import { useHealth } from '@/hooks/use-health';
import BodySvg from '@/components/body-map/BodySvg';

export default function BodyMapPage() {
    // @mock — all data from useHealth hook
    const { fatigueData, dailyLogs, healthSnapshot } = useHealth();
    const recentLogs = dailyLogs.slice(0, 5);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Body Map</h1>
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Muscle fatigue & recovery tracking
                    </p>
                </div>
                <Link
                    href="/dashboard/body-map-3d"
                    className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
                    style={{
                        background: 'var(--color-glass-bg)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-primary)',
                    }}
                >
                    Switch to 3D →
                </Link>
            </div>

            {/* Health summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'HRV', value: `${healthSnapshot.hrv}ms`, icon: Heart, color: 'var(--color-brand)' },
                    { label: 'Resting HR', value: `${healthSnapshot.restingHr} bpm`, icon: Activity, color: 'var(--color-danger)' },
                    { label: 'Sleep', value: `${healthSnapshot.sleepHours}h`, icon: Moon, color: 'var(--color-swim)' },
                    { label: 'VO₂max', value: `${healthSnapshot.vo2max}`, icon: Zap, color: 'var(--color-warning)' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="glass-card p-4 text-center">
                        <Icon size={16} style={{ color }} className="mx-auto mb-2" />
                        <div className="text-xl font-bold">{value}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
                    </div>
                ))}
            </div>

            {/* Interactive Body Map (SVG) */}
            <div className="glass-card p-6">
                <BodySvg fatigueData={fatigueData} />
            </div>

            {/* Daily logs — @mock */}
            <div className="glass-card p-6">
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                    Daily Wellness Log
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ color: 'var(--color-text-muted)' }}>
                                <th className="pb-3 text-left font-medium text-xs">Date</th>
                                <th className="pb-3 text-center font-medium text-xs">Sleep</th>
                                <th className="pb-3 text-center font-medium text-xs">HRV</th>
                                <th className="pb-3 text-center font-medium text-xs">RHR</th>
                                <th className="pb-3 text-center font-medium text-xs">RPE</th>
                                <th className="pb-3 text-center font-medium text-xs">Mood</th>
                                <th className="pb-3 text-left font-medium text-xs">Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentLogs.map((log) => (
                                <tr key={log.id} className="border-t" style={{ borderColor: 'var(--color-glass-border)' }}>
                                    <td className="py-2.5 font-medium">
                                        {new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </td>
                                    <td className="py-2.5 text-center">{log.sleepHours}h</td>
                                    <td className="py-2.5 text-center" style={{
                                        color: log.hrv >= 60 ? 'var(--color-success)' : log.hrv >= 55 ? 'var(--color-warning)' : 'var(--color-danger)',
                                    }}>
                                        {log.hrv}ms
                                    </td>
                                    <td className="py-2.5 text-center">{log.restingHr}</td>
                                    <td className="py-2.5 text-center">{log.rpe}/10</td>
                                    <td className="py-2.5 text-center">{log.mood}/10</td>
                                    <td className="py-2.5" style={{ color: 'var(--color-text-muted)' }}>
                                        {log.notes ?? '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

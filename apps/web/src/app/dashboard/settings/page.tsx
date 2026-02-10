'use client';

import { User, Bell, Watch, Shield, Save, Smartphone, Heart, LogOut } from 'lucide-react';
import { useProfile } from '@/hooks/use-profile';
import { useState } from 'react';

const connectedDevices = [
    { name: 'Garmin Fenix 8', icon: Watch, status: 'Connected', color: 'var(--color-success)' },
    { name: 'FORM Smart Goggles', icon: Smartphone, status: 'Connected', color: 'var(--color-success)' },
    { name: 'Wahoo KICKR', icon: Heart, status: 'Pending', color: 'var(--color-warning)' },
    { name: 'Apple Health', icon: Shield, status: 'Not connected', color: 'var(--color-text-muted)' },
];

export default function SettingsPage() {
    const { profile } = useProfile(); // @mock

    const [notifications, setNotifications] = useState({
        training: true,
        coach: true,
        relay: true,
        recovery: false,
    });

    const toggleNotification = (key: keyof typeof notifications) => {
        setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const notificationPrefs = [
        { key: 'training' as const, label: 'Training reminders', description: 'Daily session notifications' },
        { key: 'coach' as const, label: 'AI Coach insights', description: 'Weekly performance summaries' },
        { key: 'relay' as const, label: 'Relay baton passes', description: 'When a teammate passes the baton' },
        { key: 'recovery' as const, label: 'Recovery alerts', description: 'When readiness drops below threshold' },
    ];

    return (
        <div className="space-y-8 animate-fade-in max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Profile, devices, and preferences
                </p>
            </div>

            {/* Profile — @mock */}
            <div className="glass-card p-6">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    <User size={16} /> Profile
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            Display Name
                        </label>
                        <input type="text" defaultValue={profile.displayName} className="glass-input w-full" />
                    </div>
                    <div>
                        <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            Email
                        </label>
                        <input type="email" defaultValue={profile.email} className="glass-input w-full" disabled
                            style={{ opacity: 0.5 }} />
                    </div>
                    <div>
                        <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            Club
                        </label>
                        <input type="text" defaultValue={profile.clubName} className="glass-input w-full" disabled
                            style={{ opacity: 0.5 }} />
                    </div>
                    <div>
                        <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            Role
                        </label>
                        <input type="text" defaultValue={profile.role} className="glass-input w-full" disabled
                            style={{ opacity: 0.5 }} />
                    </div>
                    <div>
                        <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            Timezone
                        </label>
                        <input type="text" defaultValue={profile.timezone} className="glass-input w-full" />
                    </div>
                </div>
                <button className="btn-primary mt-5 flex items-center gap-2 text-sm">
                    <Save size={14} /> Save Profile
                </button>
            </div>

            {/* Connected devices — static list, real integration in Phase 2 */}
            <div className="glass-card p-6">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    <Watch size={16} /> Connected Devices
                </h3>
                <div className="space-y-3">
                    {connectedDevices.map((device) => (
                        <div key={device.name}
                            className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                                    style={{ background: `color-mix(in oklch, ${device.color}, transparent 85%)` }}>
                                    <device.icon size={16} style={{ color: device.color }} />
                                </div>
                                <span className="text-sm font-medium">{device.name}</span>
                            </div>
                            <span className="text-xs font-medium" style={{ color: device.color }}>
                                {device.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Notifications — interactive toggles */}
            <div className="glass-card p-6">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    <Bell size={16} /> Notifications
                </h3>
                <div className="space-y-4">
                    {notificationPrefs.map((pref) => (
                        <button key={pref.key}
                            onClick={() => toggleNotification(pref.key)}
                            className="flex items-center justify-between cursor-pointer w-full text-left">
                            <div>
                                <div className="text-sm font-medium">{pref.label}</div>
                                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{pref.description}</div>
                            </div>
                            <div className="w-10 h-6 rounded-full relative transition-colors shrink-0 ml-4"
                                style={{
                                    background: notifications[pref.key] ? 'var(--color-brand)' : 'oklch(0.3 0.01 260)',
                                }}>
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${notifications[pref.key] ? 'left-5' : 'left-1'
                                    }`} />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Danger zone */}
            <div className="glass-card p-6" style={{ borderColor: 'oklch(0.5 0.2 25 / 0.3)' }}>
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"
                    style={{ color: 'var(--color-danger)' }}>
                    <LogOut size={16} /> Account
                </h3>
                <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                    Sign out of your account or manage subscription.
                </p>
                <button className="px-4 py-2 text-xs font-medium rounded-lg border transition-colors hover:bg-white/5"
                    style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
                    Sign Out
                </button>
            </div>
        </div>
    );
}

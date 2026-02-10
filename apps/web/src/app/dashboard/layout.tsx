'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Dumbbell, Calendar, Brain, Activity,
    Settings, ChevronLeft, Menu,
} from 'lucide-react';
import { useState } from 'react';
import { useProfile } from '@/hooks/use-profile';
import { ThemeToggle } from '@/components/theme-toggle';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/workouts', label: 'Workouts', icon: Dumbbell },
    { href: '/dashboard/training', label: 'Training', icon: Calendar },
    { href: '/dashboard/coach', label: 'AI Coach', icon: Brain },
    { href: '/dashboard/body-map', label: 'Body Map', icon: Activity },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { profile } = useProfile(); // @mock
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const initials = profile.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase();

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Mobile overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'var(--color-overlay)' }} onClick={() => setMobileOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`
        glass-sidebar fixed lg:relative z-50 h-full flex flex-col transition-all duration-300
        ${collapsed ? 'w-[72px]' : 'w-[260px]'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
                {/* Logo */}
                <div className="flex items-center gap-3 px-5 h-16 shrink-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))' }}>
                        TRI
                    </div>
                    {!collapsed && (
                        <span className="font-semibold text-sm tracking-tight animate-fade-in">Triathlon AI</span>
                    )}
                </div>

                {/* Nav items */}
                <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
                    {navItems.map(({ href, label, icon: Icon }) => {
                        const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
                        return (
                            <Link key={href} href={href}
                                onClick={() => setMobileOpen(false)}
                                className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                      ${isActive
                                        ? 'text-white'
                                        : 'hover:bg-white/5'
                                    }
                    `}
                                style={isActive ? {
                                    background: 'linear-gradient(135deg, oklch(0.65 0.18 170 / 0.2), oklch(0.65 0.18 170 / 0.08))',
                                    color: 'var(--color-brand-light)',
                                    boxShadow: 'inset 0 0 0 1px oklch(0.65 0.18 170 / 0.15)',
                                } : { color: 'var(--color-text-secondary)' }}>
                                <Icon size={18} className="shrink-0" />
                                {!collapsed && <span>{label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* Theme toggle */}
                <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--color-glass-border)' }}>
                    <ThemeToggle collapsed={collapsed} />
                </div>

                {/* User section — @mock */}
                <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--color-glass-border)' }}>
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: 'linear-gradient(135deg, var(--color-swim), var(--color-brand))' }}>
                            {initials}
                        </div>
                        {!collapsed && (
                            <div className="min-w-0 animate-fade-in">
                                <div className="text-sm font-medium truncate">{profile.displayName}</div>
                                <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                                    {profile.clubName}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Collapse button (desktop only) */}
                <button onClick={() => setCollapsed(!collapsed)}
                    className="hidden lg:flex items-center justify-center h-10 border-t transition-colors hover:bg-white/5"
                    style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-text-muted)' }}>
                    <ChevronLeft size={16} className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
                </button>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto">
                {/* Mobile header */}
                <div className="lg:hidden flex items-center gap-3 px-4 h-14 border-b"
                    style={{ borderColor: 'var(--color-glass-border)' }}>
                    <button onClick={() => setMobileOpen(true)}
                        style={{ color: 'var(--color-text-secondary)' }}>
                        <Menu size={20} />
                    </button>
                    <span className="font-semibold text-sm">Triathlon AI</span>
                </div>

                <div className="p-6 lg:p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Dumbbell, Calendar, Brain, Activity,
} from 'lucide-react';

const tabs = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/dashboard/workouts', label: 'Workouts', icon: Dumbbell },
    { href: '/dashboard/training', label: 'Training', icon: Calendar },
    { href: '/dashboard/coach', label: 'Coach', icon: Brain },
    { href: '/dashboard/body-map', label: 'Body', icon: Activity },
];

export function MobileNav() {
    const pathname = usePathname();

    return (
        <nav className="glass-bottom-bar fixed bottom-0 left-0 right-0 z-50 lg:hidden">
            <div className="flex items-stretch justify-around"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                {tabs.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href ||
                        (href !== '/dashboard' && pathname.startsWith(href));

                    return (
                        <Link
                            key={href}
                            href={href}
                            className="relative flex flex-col items-center justify-center gap-1 py-2 px-3 min-w-[64px] min-h-[48px] transition-colors duration-200"
                            style={{
                                color: isActive
                                    ? 'var(--color-brand-light)'
                                    : 'var(--color-text-muted)',
                            }}
                        >
                            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.6} />
                            <span className="text-[10px] font-medium leading-none">
                                {label}
                            </span>
                            {isActive && (
                                <div
                                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                                    style={{
                                        background: 'linear-gradient(90deg, var(--color-brand), var(--color-brand-light))',
                                    }}
                                />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

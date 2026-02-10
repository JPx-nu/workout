'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) {
        return (
            <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-8 h-8 rounded-lg" style={{ background: 'oklch(0.2 0.01 260)' }} />
            </div>
        );
    }

    const cycle = () => {
        if (theme === 'dark') setTheme('light');
        else if (theme === 'light') setTheme('system');
        else setTheme('dark');
    };

    const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
    const label = theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light';

    return (
        <button
            onClick={cycle}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-white/5 w-full"
            style={{ color: 'var(--color-text-secondary)' }}
            title={`Theme: ${label}`}
        >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span className="animate-fade-in">{label}</span>}
        </button>
    );
}

import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center p-4"
            style={{ background: 'var(--color-bg-primary)' }}>
            <div className="glass-card p-8 max-w-sm w-full text-center space-y-4">
                <div className="text-6xl font-bold"
                    style={{ color: 'var(--color-brand)', opacity: 0.3 }}>
                    404
                </div>
                <h2 className="text-lg font-semibold">Page not found</h2>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                <Link href="/dashboard" className="btn-primary inline-block text-sm px-6 py-2">
                    Back to Dashboard
                </Link>
            </div>
        </div>
    );
}

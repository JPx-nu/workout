// ============================================================
// Profile Types
// ============================================================

export type Profile = {
    id: string;
    displayName: string;
    role: 'athlete' | 'coach' | 'admin' | 'owner';
    clubId: string;
    clubName: string;
    avatarUrl: string | null;
    timezone: string;
    email: string;
    defaultView: 'triathlon' | 'strength';
};

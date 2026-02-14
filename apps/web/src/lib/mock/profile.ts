// ============================================================
// @mock — Profile data
// TODO: Replace with Supabase auth.getUser() + profiles table
// See: docs/MOCK_DATA_MIGRATION.md
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

export const mockProfile: Profile = {
    id: 'mock-user-001',
    displayName: 'Alex Lindström',
    role: 'athlete',
    clubId: 'mock-club-001',
    clubName: 'Stockholm Tri Club',
    avatarUrl: null,
    timezone: 'Europe/Stockholm',
    email: 'alex@stockholmtri.se',
    defaultView: 'triathlon',
};

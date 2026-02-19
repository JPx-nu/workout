/// User profile data model matching Supabase `profiles` table.
class UserProfile {
  const UserProfile({
    required this.id,
    required this.displayName,
    required this.role,
    required this.clubId,
    required this.clubName,
    required this.avatarUrl,
    required this.timezone,
    required this.email,
    required this.defaultView,
  });

  final String id;
  final String displayName;
  final String role; // 'athlete' | 'coach' | 'admin'
  final String clubId;
  final String clubName;
  final String? avatarUrl;
  final String timezone;
  final String email;
  final String defaultView; // 'triathlon' | 'strength'

  static const empty = UserProfile(
    id: '',
    displayName: '',
    role: 'athlete',
    clubId: '',
    clubName: '',
    avatarUrl: null,
    timezone: 'UTC',
    email: '',
    defaultView: 'triathlon',
  );

  UserProfile copyWith({
    String? displayName,
    String? timezone,
    String? defaultView,
  }) {
    return UserProfile(
      id: id,
      displayName: displayName ?? this.displayName,
      role: role,
      clubId: clubId,
      clubName: clubName,
      avatarUrl: avatarUrl,
      timezone: timezone ?? this.timezone,
      email: email,
      defaultView: defaultView ?? this.defaultView,
    );
  }
}

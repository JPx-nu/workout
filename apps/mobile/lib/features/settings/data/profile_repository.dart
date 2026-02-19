import 'package:supabase_flutter/supabase_flutter.dart';
import 'models/profile_models.dart';

/// Fetches and updates user profile from Supabase `profiles` table.
class ProfileRepository {
  ProfileRepository(this._supabase);

  final SupabaseClient _supabase;

  /// Load the current user's profile with club join.
  Future<UserProfile> loadProfile() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return UserProfile.empty;

    final data = await _supabase
        .from('profiles')
        .select('*, clubs(name)')
        .eq('id', user.id)
        .maybeSingle();

    if (data == null) {
      return UserProfile(
        id: user.id,
        email: user.email ?? '',
        displayName: user.email?.split('@').first ?? 'User',
        role: 'athlete',
        clubId: '',
        clubName: '',
        avatarUrl: null,
        timezone: 'UTC',
        defaultView: 'triathlon',
      );
    }

    final clubs = data['clubs'] as Map<String, dynamic>?;

    return UserProfile(
      id: data['id'] as String,
      displayName:
          (data['display_name'] as String?) ?? user.email?.split('@').first ?? 'User',
      role: (data['role'] as String?) ?? 'athlete',
      clubId: (data['club_id'] as String?) ?? '',
      clubName: clubs?['name'] as String? ?? '',
      avatarUrl: data['avatar_url'] as String?,
      timezone: (data['timezone'] as String?) ?? 'UTC',
      email: user.email ?? '',
      defaultView: (data['default_view'] as String?) ?? 'triathlon',
    );
  }

  /// Update the user's default dashboard view.
  Future<void> updateDefaultView(String view) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;

    await _supabase
        .from('profiles')
        .update({'default_view': view}).eq('id', userId);
  }
}

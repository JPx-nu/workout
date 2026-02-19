import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../data/profile_repository.dart';
import '../data/models/profile_models.dart';

/// Singleton [ProfileRepository].
final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepository(Supabase.instance.client);
});

/// Loads the user profile from Supabase.
final profileProvider = FutureProvider<UserProfile>((ref) {
  return ref.watch(profileRepositoryProvider).loadProfile();
});

/// Handles profile mutations.
class ProfileNotifier extends Notifier<AsyncValue<UserProfile>> {
  @override
  AsyncValue<UserProfile> build() {
    final profileAsync = ref.watch(profileProvider);
    return profileAsync;
  }

  /// Update the preferred dashboard view (optimistic).
  Future<void> updateDefaultView(String view) async {
    final current = state.value;
    if (current == null) return;

    // Optimistic update
    state = AsyncData(current.copyWith(defaultView: view));

    try {
      await ref.read(profileRepositoryProvider).updateDefaultView(view);
    } catch (e) {
      // Revert on error
      ref.invalidate(profileProvider);
    }
  }
}

final profileNotifierProvider =
    NotifierProvider<ProfileNotifier, AsyncValue<UserProfile>>(
        ProfileNotifier.new);

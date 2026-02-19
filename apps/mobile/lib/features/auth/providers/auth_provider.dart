import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show OAuthProvider;
import '../data/auth_repository.dart';

/// Main auth state provider — drives router redirects and UI.
///
/// Uses Riverpod 3.x `Notifier` pattern. Listens to Supabase auth state
/// changes and exposes [AuthState].
final authProvider = NotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);

class AuthNotifier extends Notifier<AuthState> {
  late final AuthRepository _repo;
  StreamSubscription? _subscription;

  @override
  AuthState build() {
    _repo = ref.watch(authRepositoryProvider);

    // Set initial state based on current session
    final user = _repo.currentUser;
    final initialState = user != null
        ? AuthState.authenticated(user)
        : const AuthState.unauthenticated();

    // Listen for auth changes (sign in, sign out, token refresh)
    _subscription = _repo.authStateChanges.listen((authState) {
      state = authState;
    });

    // Cancel subscription when this provider is disposed
    ref.onDispose(() {
      _subscription?.cancel();
    });

    return initialState;
  }

  /// Email/password sign-in.
  Future<void> signIn({
    required String email,
    required String password,
  }) async {
    final result = await _repo.signInWithPassword(
      email: email,
      password: password,
    );
    state = result;
  }

  /// Email/password sign-up.
  Future<void> signUp({
    required String email,
    required String password,
  }) async {
    final result = await _repo.signUp(
      email: email,
      password: password,
    );
    state = result;
  }

  /// Demo login with hardcoded credentials.
  Future<void> signInDemo() async {
    final result = await _repo.signInWithPassword(
      email: 'demo@jpx.se',
      password: 'demodemo',
    );
    state = result;
  }

  /// OAuth sign-in (Google, Apple, etc.)
  Future<void> signInWithOAuth(OAuthProvider provider) async {
    await _repo.signInWithOAuth(provider);
    // Auth state will be updated via the stream listener
  }

  /// Sign out.
  Future<void> signOut() async {
    await _repo.signOut();
    state = const AuthState.unauthenticated();
  }
}

/// Convenience provider — true when the user is authenticated.
final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authProvider).isAuthenticated;
});

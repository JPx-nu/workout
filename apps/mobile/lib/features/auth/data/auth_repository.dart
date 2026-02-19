import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/api/api_client.dart';

/// Encapsulated authentication state.
enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  const AuthState({
    required this.status,
    this.user,
    this.error,
  });

  const AuthState.unknown() : this(status: AuthStatus.unknown);
  const AuthState.authenticated(User user)
      : this(status: AuthStatus.authenticated, user: user);
  const AuthState.unauthenticated([String? error])
      : this(status: AuthStatus.unauthenticated, error: error);

  final AuthStatus status;
  final User? user;
  final String? error;

  bool get isAuthenticated => status == AuthStatus.authenticated;
}

/// Repository that wraps Supabase Auth operations.
class AuthRepository {
  AuthRepository(this._client);

  final SupabaseClient _client;

  GoTrueClient get _auth => _client.auth;

  /// Current user (or null).
  User? get currentUser => _auth.currentUser;

  /// Current session (or null).
  Session? get currentSession => _auth.currentSession;

  /// Stream of auth state changes.
  Stream<AuthState> get authStateChanges {
    return _auth.onAuthStateChange.map((event) {
      final session = event.session;
      if (session != null) {
        return AuthState.authenticated(session.user);
      }
      return const AuthState.unauthenticated();
    });
  }

  /// Sign in with email and password.
  Future<AuthState> signInWithPassword({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _auth.signInWithPassword(
        email: email,
        password: password,
      );
      return AuthState.authenticated(response.user!);
    } on AuthException catch (e) {
      return AuthState.unauthenticated(e.message);
    } catch (e) {
      return const AuthState.unauthenticated('An unexpected error occurred.');
    }
  }

  /// Sign up with email and password.
  Future<AuthState> signUp({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _auth.signUp(
        email: email,
        password: password,
      );
      if (response.user != null) {
        return AuthState.authenticated(response.user!);
      }
      return const AuthState.unauthenticated(
        'Check your email to confirm your account.',
      );
    } on AuthException catch (e) {
      return AuthState.unauthenticated(e.message);
    } catch (e) {
      return const AuthState.unauthenticated('An unexpected error occurred.');
    }
  }

  /// Sign in with OAuth (Google, Apple, etc.)
  Future<bool> signInWithOAuth(OAuthProvider provider) async {
    try {
      return await _auth.signInWithOAuth(
        provider,
        redirectTo: 'com.jpx.jpxworkout://login-callback',
      );
    } catch (_) {
      return false;
    }
  }

  /// Sign out.
  Future<void> signOut() async {
    await _auth.signOut();
  }

  /// Refresh the current session.
  Future<void> refreshSession() async {
    await _auth.refreshSession();
  }
}

/// Provides the AuthRepository singleton.
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(supabaseProvider));
});

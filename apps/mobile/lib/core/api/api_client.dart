import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Provides the Supabase client singleton.
final supabaseProvider = Provider<SupabaseClient>((ref) {
  return Supabase.instance.client;
});

/// Provides a configured Dio HTTP client for the Hono API.
final dioProvider = Provider<Dio>((ref) {
  final supabase = ref.watch(supabaseProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: const String.fromEnvironment(
        'API_URL',
        defaultValue: 'http://localhost:3001',
      ),
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  // Auth interceptor — attaches Supabase JWT to every request
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final session = supabase.auth.currentSession;
        if (session != null) {
          options.headers['Authorization'] = 'Bearer ${session.accessToken}';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        // If 401, try refreshing the session
        if (error.response?.statusCode == 401) {
          try {
            await supabase.auth.refreshSession();
            final newSession = supabase.auth.currentSession;
            if (newSession != null) {
              error.requestOptions.headers['Authorization'] =
                  'Bearer ${newSession.accessToken}';
              final retryResponse = await dio.fetch(error.requestOptions);
              return handler.resolve(retryResponse);
            }
          } catch (_) {
            // Refresh failed — let the error propagate
          }
        }
        return handler.next(error);
      },
    ),
  );

  return dio;
});

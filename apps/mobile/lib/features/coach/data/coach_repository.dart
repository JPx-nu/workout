import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'models/coach_models.dart';

/// Repository for AI Coach data — mirrors web `use-coach.ts`.
///
/// Handles:
/// - Loading conversation list from the Hono API
/// - Loading messages from Supabase `messages` table
/// - Streaming chat responses via SSE (`POST /api/ai/chat`)
/// - Uploading images to Supabase Storage `chat-images` bucket
class CoachRepository {
  CoachRepository({required this.dio, required this.supabase});

  final Dio dio;
  final SupabaseClient supabase;

  // ── Conversations list ──────────────────────────────────────
  Future<List<ConversationSummary>> loadConversations() async {
    try {
      final response = await dio.get<Map<String, dynamic>>(
        '/api/ai/conversations',
      );
      final data = response.data;
      if (data == null) return [];

      final list = data['conversations'] as List<dynamic>?;
      if (list == null) return [];

      return list
          .map((e) =>
              ConversationSummary.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException {
      // Conversations sidebar is non-critical — fail silently
      return [];
    }
  }

  // ── Load a conversation's messages ──────────────────────────
  Future<List<ChatMessage>> loadMessages(String conversationId) async {
    final response = await supabase
        .from('messages')
        .select()
        .eq('conversation_id', conversationId)
        .order('created_at', ascending: true);

    return (response as List<dynamic>)
        .map((e) => ChatMessage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── Send message with SSE streaming ─────────────────────────
  /// Returns a [Stream] of [SseEvent]s parsed from the API response.
  ///
  /// The caller should listen to this stream and update UI state
  /// accordingly (delta tokens, metadata, tool calls, etc.).
  Stream<SseEvent> sendMessageStream({
    required String message,
    String? conversationId,
    List<String>? imageUrls,
    CancelToken? cancelToken,
  }) async* {
    final body = <String, dynamic>{
      'message': message,
      'conversationId': ?conversationId,
      'imageUrls': ?imageUrls,
    };

    final response = await dio.post<ResponseBody>(
      '/api/ai/chat',
      data: body,
      options: Options(responseType: ResponseType.stream),
      cancelToken: cancelToken,
    );

    final stream = response.data?.stream;
    if (stream == null) return;

    // Check for non-SSE JSON response (safety blocks, config errors)
    final contentType =
        response.headers.value('content-type') ?? '';
    if (contentType.contains('application/json')) {
      // Collect the full body and yield a single message or error
      final bytes = await stream.fold<List<int>>(
        [],
        (prev, chunk) => prev..addAll(chunk),
      );
      final data =
          json.decode(utf8.decode(bytes)) as Map<String, dynamic>;
      final content =
          data['content'] as String? ?? data['error'] as String? ?? '';
      if (data['conversationId'] != null) {
        yield SseMetadata(
            conversationId: data['conversationId'] as String);
      }
      yield SseDelta(content: content);
      yield const SseDone();
      return;
    }

    // Parse SSE stream
    String buffer = '';
    String eventType = '';

    await for (final chunk in stream) {
      buffer += utf8.decode(chunk);

      final lines = buffer.split('\n');
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.removeLast();

      for (final line in lines) {
        if (line.startsWith('event: ')) {
          eventType = line.substring(7).trim();
        } else if (line.startsWith('data: ')) {
          final dataStr = line.substring(6);
          try {
            final data =
                json.decode(dataStr) as Map<String, dynamic>;
            final event = _parseEvent(eventType, data);
            if (event != null) yield event;
          } catch (_) {
            // Skip malformed JSON
          }
        }
      }
    }
  }

  SseEvent? _parseEvent(String type, Map<String, dynamic> data) {
    return switch (type) {
      'metadata' when data['conversationId'] != null =>
        SseMetadata(conversationId: data['conversationId'] as String),
      'delta' => SseDelta(content: data['content'] as String? ?? ''),
      'tool' => SseToolCall(tool: data['tool'] as String? ?? ''),
      'correction' =>
        SseCorrection(content: data['content'] as String? ?? ''),
      'error' =>
        SseError(message: data['message'] as String? ?? 'Unknown error'),
      'done' => const SseDone(),
      _ => null,
    };
  }

  // ── Image upload ────────────────────────────────────────────
  /// Uploads an image to Supabase Storage and returns a signed URL.
  Future<String?> uploadImage(XFile file, String conversationId) async {
    try {
      final user = supabase.auth.currentUser;
      final userId = user?.id ?? 'anon';
      final ext = file.path.split('.').last;
      final ts = DateTime.now().millisecondsSinceEpoch;
      final path = '$userId/$conversationId/$ts.$ext';

      final bytes = await file.readAsBytes();
      await supabase.storage
          .from('chat-images')
          .uploadBinary(path, bytes, fileOptions: FileOptions(
            contentType: file.mimeType ?? 'image/jpeg',
          ));

      // Create a 1-hour signed URL
      final signedUrl = await supabase.storage
          .from('chat-images')
          .createSignedUrl(path, 3600);

      return signedUrl;
    } catch (_) {
      return null;
    }
  }
}

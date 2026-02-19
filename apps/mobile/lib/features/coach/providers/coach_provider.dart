import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_client.dart';
import '../data/coach_repository.dart';
import '../data/models/coach_models.dart';

// ─── Repository provider ─────────────────────────────────────
final coachRepositoryProvider = Provider<CoachRepository>((ref) {
  return CoachRepository(
    dio: ref.watch(dioProvider),
    supabase: ref.watch(supabaseProvider),
  );
});

// ─── Conversations list (sidebar) ────────────────────────────
final conversationsProvider =
    FutureProvider<List<ConversationSummary>>((ref) {
  return ref.watch(coachRepositoryProvider).loadConversations();
});

// ─── Coach state ─────────────────────────────────────────────
class CoachState {
  const CoachState({
    this.messages = const [],
    this.isTyping = false,
    this.conversationId,
    this.error,
    this.activeToolCalls = const [],
    this.attachedImages = const [],
  });

  final List<ChatMessage> messages;
  final bool isTyping;
  final String? conversationId;
  final String? error;
  final List<String> activeToolCalls;
  final List<XFile> attachedImages;

  CoachState copyWith({
    List<ChatMessage>? messages,
    bool? isTyping,
    String? conversationId,
    String? error,
    List<String>? activeToolCalls,
    List<XFile>? attachedImages,
    bool clearConversationId = false,
    bool clearError = false,
  }) {
    return CoachState(
      messages: messages ?? this.messages,
      isTyping: isTyping ?? this.isTyping,
      conversationId: clearConversationId
          ? null
          : (conversationId ?? this.conversationId),
      error: clearError ? null : (error ?? this.error),
      activeToolCalls: activeToolCalls ?? this.activeToolCalls,
      attachedImages: attachedImages ?? this.attachedImages,
    );
  }
}

// ─── Coach notifier ──────────────────────────────────────────
final coachProvider =
    NotifierProvider<CoachNotifier, CoachState>(CoachNotifier.new);

class CoachNotifier extends Notifier<CoachState> {
  CancelToken? _cancelToken;
  StreamSubscription<SseEvent>? _subscription;

  CoachRepository get _repo => ref.read(coachRepositoryProvider);

  @override
  CoachState build() => const CoachState();

  // ── Image attachment ──────────────────────────────────────
  static const _maxImages = 3;

  void attachImage(XFile file) {
    if (state.attachedImages.length >= _maxImages) {
      state = state.copyWith(error: 'Max $_maxImages images per message.');
      return;
    }
    // Basic size check (synchronous — XFile gives us path, not size)
    state = state.copyWith(
      attachedImages: [...state.attachedImages, file],
      clearError: true,
    );
  }

  void removeImage(int index) {
    final images = [...state.attachedImages]..removeAt(index);
    state = state.copyWith(attachedImages: images);
  }

  // ── New conversation ──────────────────────────────────────
  void newConversation() {
    _cancelStreaming();
    state = const CoachState();
  }

  // ── Load existing conversation ────────────────────────────
  Future<void> loadConversation(String conversationId) async {
    _cancelStreaming();
    state = state.copyWith(
      isTyping: false,
      clearError: true,
      activeToolCalls: [],
    );

    try {
      final messages = await _repo.loadMessages(conversationId);
      state = CoachState(
        messages: messages,
        conversationId: conversationId,
      );
    } catch (e) {
      state = state.copyWith(error: 'Failed to load conversation: $e');
    }
  }

  // ── Send message ──────────────────────────────────────────
  Future<void> sendMessage(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || state.isTyping) return;

    final imagesToUpload = [...state.attachedImages];

    // 1. Add optimistic user message
    final userMsg = ChatMessage(
      id: 'msg-${DateTime.now().millisecondsSinceEpoch}',
      role: 'user',
      content: trimmed,
      createdAt: DateTime.now().toIso8601String(),
    );

    state = state.copyWith(
      messages: [...state.messages, userMsg],
      isTyping: true,
      clearError: true,
      activeToolCalls: [],
      attachedImages: [],
    );

    // 2. Upload images if any
    List<String>? imageUrls;
    if (imagesToUpload.isNotEmpty) {
      final convId = state.conversationId ?? 'pending';
      final urls = <String>[];
      for (final file in imagesToUpload) {
        final url = await _repo.uploadImage(file, convId);
        if (url != null) urls.add(url);
      }
      if (urls.isNotEmpty) imageUrls = urls;
    }

    // 3. Stream response
    _cancelToken = CancelToken();
    final assistantMsgId =
        'msg-${DateTime.now().millisecondsSinceEpoch + 1}';

    // Add empty assistant message that we'll fill in
    final assistantMsg = ChatMessage(
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      createdAt: DateTime.now().toIso8601String(),
    );
    state = state.copyWith(
      messages: [...state.messages, assistantMsg],
    );

    String assistantContent = '';

    try {
      final stream = _repo.sendMessageStream(
        message: trimmed,
        conversationId: state.conversationId,
        imageUrls: imageUrls,
        cancelToken: _cancelToken,
      );

      await for (final event in stream) {
        switch (event) {
          case SseMetadata(:final conversationId):
            state = state.copyWith(conversationId: conversationId);

          case SseDelta(:final content):
            assistantContent += content;
            _updateAssistantMessage(assistantMsgId, assistantContent);

          case SseCorrection(:final content):
            assistantContent = content;
            _updateAssistantMessage(assistantMsgId, assistantContent);

          case SseToolCall(:final tool):
            state = state.copyWith(
              activeToolCalls: [...state.activeToolCalls, tool],
            );

          case SseError(:final message):
            state = state.copyWith(error: message);
            _updateAssistantMessage(assistantMsgId, message);

          case SseDone():
            // Refresh conversations list
            ref.invalidate(conversationsProvider);
        }
      }
    } on DioException catch (e) {
      if (e.type == DioExceptionType.cancel) return;
      state = state.copyWith(
        error: 'Failed to connect to AI Coach. Please try again.',
      );
    } catch (e) {
      state = state.copyWith(error: '$e');
    } finally {
      state = state.copyWith(isTyping: false);
      _cancelToken = null;
    }
  }

  void _updateAssistantMessage(String msgId, String content) {
    state = state.copyWith(
      messages: state.messages
          .map((m) => m.id == msgId ? m.copyWithContent(content) : m)
          .toList(),
    );
  }

  // ── Stop streaming ────────────────────────────────────────
  void stopStreaming() => _cancelStreaming();

  void _cancelStreaming() {
    _cancelToken?.cancel();
    _cancelToken = null;
    _subscription?.cancel();
    _subscription = null;
    if (state.isTyping) {
      state = state.copyWith(isTyping: false);
    }
  }
}

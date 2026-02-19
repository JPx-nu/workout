// Data models for the AI Coach feature.
//
// Mirrors the web types from `lib/mock/coach.ts` and the SSE event
// shapes emitted by `POST /api/ai/chat`.

// ─── Message metadata ────────────────────────────────────────
class MessageMetadata {
  const MessageMetadata({
    this.sources,
    this.confidence,
    this.toolCalls,
    this.imageUrls,
  });

  final List<String>? sources;
  final double? confidence;
  final List<String>? toolCalls;
  final List<String>? imageUrls;

  factory MessageMetadata.fromJson(Map<String, dynamic> json) {
    return MessageMetadata(
      sources: (json['sources'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      confidence: (json['confidence'] as num?)?.toDouble(),
      toolCalls: (json['toolCalls'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      imageUrls: (json['imageUrls'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
    );
  }
}

// ─── Chat message ────────────────────────────────────────────
class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.createdAt,
    this.metadata,
  });

  final String id;
  final String role; // 'user' | 'assistant' | 'system'
  final String content;
  final String createdAt;
  final MessageMetadata? metadata;

  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant';

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String,
      role: json['role'] as String,
      content: json['content'] as String? ?? '',
      createdAt: json['created_at'] as String? ??
          json['createdAt'] as String? ??
          DateTime.now().toIso8601String(),
      metadata: json['metadata'] != null
          ? MessageMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>)
          : null,
    );
  }

  /// Create a copy with updated content (used during SSE streaming).
  ChatMessage copyWithContent(String newContent) {
    return ChatMessage(
      id: id,
      role: role,
      content: newContent,
      createdAt: createdAt,
      metadata: metadata,
    );
  }

  /// Create a copy with updated metadata.
  ChatMessage copyWithMetadata(MessageMetadata? newMetadata) {
    return ChatMessage(
      id: id,
      role: role,
      content: content,
      createdAt: createdAt,
      metadata: newMetadata,
    );
  }
}

// ─── Conversation summary (for sidebar list) ─────────────────
class ConversationSummary {
  const ConversationSummary({
    required this.id,
    this.title,
    required this.updatedAt,
    required this.messageCount,
  });

  final String id;
  final String? title;
  final String updatedAt;
  final int messageCount;

  factory ConversationSummary.fromJson(Map<String, dynamic> json) {
    return ConversationSummary(
      id: json['id'] as String,
      title: json['title'] as String?,
      updatedAt: json['updated_at'] as String? ??
          json['updatedAt'] as String? ??
          '',
      messageCount: json['message_count'] as int? ??
          json['messageCount'] as int? ??
          0,
    );
  }
}

// ─── Sealed class for SSE events ─────────────────────────────
sealed class SseEvent {
  const SseEvent();
}

class SseMetadata extends SseEvent {
  const SseMetadata({required this.conversationId});
  final String conversationId;
}

class SseDelta extends SseEvent {
  const SseDelta({required this.content});
  final String content;
}

class SseToolCall extends SseEvent {
  const SseToolCall({required this.tool});
  final String tool;
}

class SseCorrection extends SseEvent {
  const SseCorrection({required this.content});
  final String content;
}

class SseError extends SseEvent {
  const SseError({required this.message});
  final String message;
}

class SseDone extends SseEvent {
  const SseDone();
}

// ─── Suggested prompts (matches web) ─────────────────────────
const suggestedPrompts = [
  'Why are my legs so tired?',
  'Create a taper plan for my race',
  'Analyze my swim technique trends',
  'What should I eat before a long ride?',
  'Compare my run pace this month vs last',
];

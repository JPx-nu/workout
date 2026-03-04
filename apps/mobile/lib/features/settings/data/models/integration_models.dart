class IntegrationStatus {
  const IntegrationStatus({
    required this.provider,
    required this.connected,
    required this.lastSyncAt,
    required this.providerUid,
    required this.available,
    required this.availabilityReason,
    required this.applyUrl,
    required this.actions,
  });

  final String provider;
  final bool connected;
  final DateTime? lastSyncAt;
  final String? providerUid;
  final bool available;
  final String? availabilityReason;
  final String? applyUrl;
  final IntegrationActions actions;

  factory IntegrationStatus.fromJson(Map<String, dynamic> json) {
    final lastSyncRaw = json['lastSyncAt'] as String?;
    return IntegrationStatus(
      provider: (json['provider'] as String? ?? '').toUpperCase(),
      connected: json['connected'] as bool? ?? false,
      lastSyncAt: lastSyncRaw == null ? null : DateTime.tryParse(lastSyncRaw),
      providerUid: json['providerUid'] as String?,
      available: json['available'] as bool? ?? true,
      availabilityReason: json['availabilityReason'] as String?,
      applyUrl: json['applyUrl'] as String?,
      actions: IntegrationActions.fromJson(
        json['actions'] as Map<String, dynamic>? ?? const {},
      ),
    );
  }
}

class IntegrationActions {
  const IntegrationActions({
    required this.connect,
    required this.disconnect,
    required this.sync,
  });

  final String? connect;
  final String? disconnect;
  final String? sync;

  factory IntegrationActions.fromJson(Map<String, dynamic> json) {
    return IntegrationActions(
      connect: json['connect'] as String?,
      disconnect: json['disconnect'] as String?,
      sync: json['sync'] as String?,
    );
  }
}

class IntegrationStatusSnapshot {
  const IntegrationStatusSnapshot({
    required this.integrations,
    required this.webhookQueueSize,
  });

  final List<IntegrationStatus> integrations;
  final int webhookQueueSize;

  factory IntegrationStatusSnapshot.fromJson(Map<String, dynamic> json) {
    final list = json['integrations'] as List<dynamic>? ?? const [];
    return IntegrationStatusSnapshot(
      integrations: list
          .map((item) =>
              IntegrationStatus.fromJson(item as Map<String, dynamic>))
          .toList(),
      webhookQueueSize: (json['webhookQueueSize'] as num?)?.toInt() ?? 0,
    );
  }
}

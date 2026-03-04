import 'package:dio/dio.dart';

import 'models/integration_models.dart';

/// Fetches integration connection status from the API.
class IntegrationRepository {
  IntegrationRepository(this._dio);

  final Dio _dio;

  Future<IntegrationStatusSnapshot> loadIntegrationStatus() async {
    final response =
        await _dio.get<Map<String, dynamic>>('/api/integrations/status');
    final data = response.data;
    if (data == null) {
      return const IntegrationStatusSnapshot(
        integrations: [],
        webhookQueueSize: 0,
      );
    }
    return IntegrationStatusSnapshot.fromJson(data);
  }

  Uri buildAbsoluteUri(String pathOrUrl) {
    final raw = pathOrUrl.trim();
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return Uri.parse(raw);
    }
    final baseUri = Uri.parse(_dio.options.baseUrl);
    return baseUri.resolve(raw);
  }

  Future<void> disconnectIntegration(IntegrationStatus integration) async {
    final path = integration.actions.disconnect;
    if (path == null || path.isEmpty) return;
    await _dio.post<void>(path);
  }

  Future<void> syncIntegration(IntegrationStatus integration) async {
    final path = integration.actions.sync;
    if (path == null || path.isEmpty) return;
    await _dio.post<void>(path);
  }
}

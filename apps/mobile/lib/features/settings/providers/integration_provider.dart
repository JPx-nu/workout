import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../data/integration_repository.dart';
import '../data/models/integration_models.dart';

final integrationRepositoryProvider = Provider<IntegrationRepository>((ref) {
  return IntegrationRepository(ref.watch(dioProvider));
});

/// Loads current integration status from the API.
final integrationStatusProvider = FutureProvider<IntegrationStatusSnapshot>(
  (ref) {
    return ref.watch(integrationRepositoryProvider).loadIntegrationStatus();
  },
);

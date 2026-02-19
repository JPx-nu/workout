import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../data/health_repository.dart';
import '../data/models/health_models.dart';

/// Singleton [HealthRepository] instance.
final healthRepositoryProvider = Provider<HealthRepository>((ref) {
  return HealthRepository(Supabase.instance.client);
});

/// Combined health state.
class HealthState {
  const HealthState({
    required this.snapshot,
    required this.fatigueData,
    required this.dailyLogs,
  });

  final HealthSnapshot snapshot;
  final List<MuscleFatigue> fatigueData;
  final List<DailyLog> dailyLogs;
}

/// Loads all health data in one shot.
final healthProvider = FutureProvider<HealthState>((ref) async {
  final repo = ref.watch(healthRepositoryProvider);
  final results = await Future.wait([
    repo.loadDailyLogs(),
    repo.loadFatigueData(),
  ]);

  final logs = results[0] as List<DailyLog>;
  final fatigue = results[1] as List<MuscleFatigue>;
  final snapshot = repo.buildSnapshot(logs);

  return HealthState(
    snapshot: snapshot,
    fatigueData: fatigue,
    dailyLogs: logs,
  );
});

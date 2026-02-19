import 'package:supabase_flutter/supabase_flutter.dart';
import 'models/health_models.dart';

/// Fetches health data from Supabase `daily_logs` and `injuries` tables.
class HealthRepository {
  HealthRepository(this._supabase);

  final SupabaseClient _supabase;

  /// Last 7 days of daily wellness logs.
  Future<List<DailyLog>> loadDailyLogs() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return [];

    final data = await _supabase
        .from('daily_logs')
        .select()
        .eq('athlete_id', userId)
        .order('log_date', ascending: false)
        .limit(7);

    return (data as List).map((row) {
      return DailyLog.fromRow(row as Map<String, dynamic>);
    }).toList();
  }

  /// Build [HealthSnapshot] from the latest daily log.
  HealthSnapshot buildSnapshot(List<DailyLog> logs) {
    if (logs.isEmpty) return HealthSnapshot.empty;
    final latest = logs.first;
    return HealthSnapshot(
      hrv: latest.hrv,
      restingHr: latest.restingHr,
      sleepHours: latest.sleepHours,
      sleepQuality: latest.sleepQuality,
      vo2max: 0, // no direct source yet
      weightKg: latest.weightKg,
      readinessScore: _calculateReadiness(latest),
    );
  }

  /// Build fatigue data by merging default muscle groups with active injuries.
  Future<List<MuscleFatigue>> loadFatigueData() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return List.of(defaultMuscleGroups);

    final data = await _supabase
        .from('injuries')
        .select()
        .eq('athlete_id', userId)
        .isFilter('resolved_at', null);

    final injuryMap = <String, MuscleFatigue>{};
    for (final row in data as List) {
      final r = row as Map<String, dynamic>;
      final severity = (r['severity'] as num?)?.toInt() ?? 50;
      final bodyPart = r['body_part'] as String? ?? '';

      FatigueLevel status;
      if (severity >= 70) {
        status = FatigueLevel.high;
      } else if (severity >= 40) {
        status = FatigueLevel.moderate;
      } else {
        status = FatigueLevel.low;
      }

      injuryMap[bodyPart] = MuscleFatigue(
        muscle: bodyPart,
        bodyPart: bodyPart,
        level: severity,
        status: status,
      );
    }

    // Merge defaults with overrides
    final merged = defaultMuscleGroups.map((def) {
      return injuryMap[def.bodyPart] ?? def;
    }).toList();

    // Add extras not in default list
    for (final entry in injuryMap.entries) {
      if (!defaultMuscleGroups.any((d) => d.bodyPart == entry.key)) {
        merged.add(entry.value);
      }
    }

    return merged;
  }

  int _calculateReadiness(DailyLog log) {
    final raw =
        (log.sleepQuality * 10 + log.mood * 5 + (log.hrv > 0 ? 30 : 0)) / 1.4;
    return raw.round().clamp(0, 100);
  }
}

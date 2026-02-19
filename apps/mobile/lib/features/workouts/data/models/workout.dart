/// Workout model matching the Supabase `workouts` table schema.
///
/// Uses plain Dart classes (no Freezed dependency needed for simple data).
class Workout {
  const Workout({
    required this.id,
    required this.athleteId,
    this.clubId,
    required this.activityType,
    required this.source,
    required this.startedAt,
    required this.durationS,
    this.distanceM,
    this.avgHr,
    this.maxHr,
    this.avgPaceSecKm,
    this.avgPowerW,
    this.calories,
    this.tss,
    this.notes,
    this.createdAt,
  });

  final String id;
  final String athleteId;
  final String? clubId;
  final String activityType; // SWIM, BIKE, RUN, STRENGTH, YOGA, OTHER
  final String source; // GARMIN, POLAR, WAHOO, FORM, MANUAL, HEALTHKIT, HEALTH_CONNECT
  final DateTime startedAt;
  final int durationS;
  final double? distanceM;
  final int? avgHr;
  final int? maxHr;
  final int? avgPaceSecKm;
  final int? avgPowerW;
  final int? calories;
  final int? tss;
  final String? notes;
  final DateTime? createdAt;

  /// Create from Supabase row (snake_case JSON).
  factory Workout.fromJson(Map<String, dynamic> json) {
    return Workout(
      id: json['id'] as String,
      athleteId: json['athlete_id'] as String,
      clubId: json['club_id'] as String?,
      activityType: json['activity_type'] as String,
      source: json['source'] as String,
      startedAt: DateTime.parse(json['started_at'] as String),
      durationS: (json['duration_s'] as num?)?.toInt() ?? 0,
      distanceM: (json['distance_m'] as num?)?.toDouble(),
      avgHr: (json['avg_hr'] as num?)?.toInt(),
      maxHr: (json['max_hr'] as num?)?.toInt(),
      avgPaceSecKm: (json['avg_pace_s_km'] as num?)?.toInt(),
      avgPowerW: (json['avg_power_w'] as num?)?.toInt(),
      calories: (json['calories'] as num?)?.toInt(),
      tss: (json['tss'] as num?)?.toInt(),
      notes: json['notes'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'athlete_id': athleteId,
        'club_id': clubId,
        'activity_type': activityType,
        'source': source,
        'started_at': startedAt.toIso8601String(),
        'duration_s': durationS,
        'distance_m': distanceM,
        'avg_hr': avgHr,
        'max_hr': maxHr,
        'avg_pace_s_km': avgPaceSecKm,
        'avg_power_w': avgPowerW,
        'calories': calories,
        'tss': tss,
        'notes': notes,
      };

  // ── Helpers ──────────────────────────────────────────────

  /// Duration formatted as "1h 23m" or "45m".
  String get formattedDuration {
    final h = durationS ~/ 3600;
    final m = (durationS % 3600) ~/ 60;
    return h > 0 ? '${h}h ${m}m' : '${m}m';
  }

  /// Distance in km, rounded to 1 decimal.
  double? get distanceKm =>
      distanceM != null ? (distanceM! / 1000 * 10).roundToDouble() / 10 : null;

  /// Pace formatted as "5:30/km" (for run/swim).
  String? get formattedPace {
    if (distanceM == null || distanceM == 0) return null;
    final paceSecPerKm = (durationS / distanceM!) * 1000;
    final min = paceSecPerKm ~/ 60;
    final sec = (paceSecPerKm % 60).round();
    return '$min:${sec.toString().padLeft(2, '0')}/km';
  }
}

/// Weekly aggregate stats, computed from a list of workouts.
class WeeklyStats {
  const WeeklyStats({
    required this.swim,
    required this.bike,
    required this.run,
    required this.strength,
    required this.totalTSS,
    required this.totalWorkouts,
    required this.totalDurationMin,
  });

  final SportStats swim;
  final SportStats bike;
  final SportStats run;
  final SportStats strength;
  final int totalTSS;
  final int totalWorkouts;
  final int totalDurationMin;

  static const empty = WeeklyStats(
    swim: SportStats.zero,
    bike: SportStats.zero,
    run: SportStats.zero,
    strength: SportStats.zero,
    totalTSS: 0,
    totalWorkouts: 0,
    totalDurationMin: 0,
  );
}

class SportStats {
  const SportStats({
    required this.sessions,
    required this.durationMin,
    this.distanceKm = 0,
  });

  final int sessions;
  final int durationMin;
  final double distanceKm;

  static const zero = SportStats(sessions: 0, durationMin: 0);
}

/// A single day's chart data — minutes of training per sport.
class ChartDataPoint {
  const ChartDataPoint({
    required this.day,
    this.swim = 0,
    this.bike = 0,
    this.run = 0,
    this.strength = 0,
  });

  final String day;
  final int swim;
  final int bike;
  final int run;
  final int strength;

  int get total => swim + bike + run + strength;
}

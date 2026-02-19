import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/api_client.dart';
import 'models/workout.dart';

/// Provides the workout repository singleton.
final workoutRepositoryProvider = Provider<WorkoutRepository>((ref) {
  return WorkoutRepository(ref.watch(supabaseProvider));
});

/// Repository for fetching and computing workout data from Supabase.
class WorkoutRepository {
  WorkoutRepository(this._supabase);

  final SupabaseClient _supabase;

  // ── Fetch ────────────────────────────────────────────────

  /// Fetches all workouts for the current user, sorted newest-first.
  Future<List<Workout>> fetchWorkouts({String? activityType}) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return [];

    // Build filter chain first (.eq), then transform (.order) last
    var filter = _supabase
        .from('workouts')
        .select()
        .eq('athlete_id', userId);

    if (activityType != null && activityType != 'ALL') {
      filter = filter.eq('activity_type', activityType);
    }

    final data = await filter.order('started_at', ascending: false);
    return (data as List)
        .map((row) => Workout.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  // ── Compute Weekly Stats ────────────────────────────────

  /// Computes weekly aggregate stats from a list of workouts.
  WeeklyStats computeWeeklyStats(List<Workout> workouts) {
    final now = DateTime.now();
    final weekAgo = now.subtract(const Duration(days: 7));
    final thisWeek =
        workouts.where((w) => w.startedAt.isAfter(weekAgo)).toList();

    SportStats byType(String type) {
      final filtered = thisWeek.where((w) => w.activityType == type).toList();
      final durationMin =
          filtered.fold<int>(0, (sum, w) => sum + w.durationS) ~/ 60;
      final distanceKm = filtered.fold<double>(
              0, (sum, w) => sum + (w.distanceM ?? 0)) /
          1000;
      return SportStats(
        sessions: filtered.length,
        durationMin: durationMin,
        distanceKm: (distanceKm * 10).roundToDouble() / 10,
      );
    }

    final totalTSS =
        thisWeek.fold<int>(0, (sum, w) => sum + (w.tss ?? 0));
    final totalDurationMin =
        thisWeek.fold<int>(0, (sum, w) => sum + w.durationS) ~/ 60;

    return WeeklyStats(
      swim: byType('SWIM'),
      bike: byType('BIKE'),
      run: byType('RUN'),
      strength: byType('STRENGTH'),
      totalTSS: totalTSS,
      totalWorkouts: thisWeek.length,
      totalDurationMin: totalDurationMin,
    );
  }

  // ── Compute 7-Day Chart Data ────────────────────────────

  /// Computes stacked chart data for current Mon–Sun week.
  List<ChartDataPoint> computeChartData(List<Workout> workouts) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final now = DateTime.now();

    // Find Monday of this week
    final dayOfWeek = now.weekday; // Mon=1..Sun=7
    final startOfWeek = DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: dayOfWeek - 1));

    return List.generate(7, (i) {
      final date = startOfWeek.add(Duration(days: i));
      final dayStr =
          '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

      final dayWorkouts = workouts.where((w) {
        final ws =
            '${w.startedAt.year}-${w.startedAt.month.toString().padLeft(2, '0')}-${w.startedAt.day.toString().padLeft(2, '0')}';
        return ws == dayStr;
      }).toList();

      int minutesByType(String type) => dayWorkouts
          .where((w) => w.activityType == type)
          .fold<int>(0, (sum, w) => sum + w.durationS) ~/
          60;

      return ChartDataPoint(
        day: days[i],
        swim: minutesByType('SWIM'),
        bike: minutesByType('BIKE'),
        run: minutesByType('RUN'),
        strength: minutesByType('STRENGTH'),
      );
    });
  }
}
